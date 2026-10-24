import { getPool, sql } from '../../database/db.js';

export interface OrderListFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ShipmentUpdateData {
  carrier: string;
  trackingNumber: string;
  packageWeight?: number;
  packageLength?: number;
  packageWidth?: number;
  packageHeight?: number;
  estimatedDeliveryDate?: string;
}

export class OrdersRepository {
  /**
   * Retrieves order volume and revenue KPIs for this seller by linking
   * Orders -> OrderItems -> SellerProducts (SellerID).
   */
  async getOrdersSummary(sellerId: bigint | number) {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('sellerId', sql.BigInt, sellerId)
      .query(`
        SELECT 
          COUNT(DISTINCT o.OrderID) AS TotalOrders,
          ISNULL(SUM(CASE WHEN o.Status IN ('PENDING', 'CONFIRMED', 'CREATED') THEN 1 ELSE 0 END), 0) AS PendingOrders,
          ISNULL(SUM(CASE WHEN o.Status IN ('PROCESSING', 'PACKING', 'READY_TO_SHIP') THEN 1 ELSE 0 END), 0) AS ProcessingOrders,
          ISNULL(SUM(CASE WHEN o.Status IN ('SHIPPED', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) AS ShippedOrders,
          ISNULL(SUM(CASE WHEN o.Status = 'DELIVERED' THEN 1 ELSE 0 END), 0) AS DeliveredOrders,
          ISNULL(SUM(CASE WHEN o.Status IN ('CANCELLED', 'REFUNDED') THEN 1 ELSE 0 END), 0) AS CancelledOrders,
          ISNULL(SUM(oi.TotalAmount), 0) AS TotalRevenue
        FROM dbo.Orders o
        JOIN dbo.OrderItems oi ON o.OrderID = oi.OrderID
        JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID AND sp.SellerID = @sellerId;
      `);

    return result.recordset[0];
  }

  /**
   * Retrieves paginated list of orders for the seller with customer info, item count, and fulfillment status.
   * Links Orders -> OrderItems -> SellerProducts (SellerID).
   */
  async getOrdersList(sellerId: bigint | number, filters: OrderListFilters) {
    const pool = await getPool();
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        o.OrderID AS SellerOrderID,
        o.OrderID,
        COALESCE(f.Status, o.Status) AS SellerOrderStatus,
        o.CreatedAt AS OrderPlacedAt,
        COALESCE(f.UpdatedAt, o.UpdatedAt, o.CreatedAt) AS OrderUpdatedAt,
        o.OrderNumber,
        o.Status AS MasterOrderStatus,
        c.CustomerID,
        c.FirstName AS CustomerFirstName,
        c.LastName AS CustomerLastName,
        c.Email AS CustomerEmail,
        c.PhoneNumber AS CustomerPhone,
        o.ShippingRecipientName,
        o.ShippingCity,
        o.ShippingState,
        o.ShippingPostalCode,
        COUNT(oi.OrderItemID) AS TotalItemLines,
        ISNULL(SUM(oi.Quantity), 0) AS TotalQuantity,
        ISNULL(SUM(oi.TotalAmount), 0) AS SellerOrderAmount,
        MAX(f.FulfillmentID) AS FulfillmentID,
        MAX(f.WarehouseID) AS WarehouseID,
        MAX(w.WarehouseName) AS WarehouseName,
        MAX(s.ShipmentID) AS ShipmentID,
        MAX(s.Carrier) AS Carrier,
        MAX(s.TrackingNumber) AS TrackingNumber,
        MAX(s.Status) AS ShipmentStatus,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.Orders o
      JOIN dbo.OrderItems oi ON o.OrderID = oi.OrderID
      JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID AND sp.SellerID = @sellerId
      JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
      LEFT JOIN dbo.Fulfillments f ON o.OrderID = f.OrderID AND f.SellerID = @sellerId
      LEFT JOIN dbo.Warehouses w ON f.WarehouseID = w.WarehouseID
      LEFT JOIN dbo.Shipments s ON f.FulfillmentID = s.FulfillmentID
      WHERE 1=1
    `;

    const request = pool.request().input('sellerId', sql.BigInt, sellerId);

    if (filters.status && filters.status !== 'ALL') {
      request.input('status', sql.VarChar, filters.status);
      query += ` AND COALESCE(f.Status, o.Status) = @status`;
    }

    if (filters.search && filters.search.trim()) {
      request.input('search', sql.NVarChar, `%${filters.search.trim()}%`);
      query += ` AND (
        o.OrderNumber LIKE @search OR
        c.FirstName LIKE @search OR
        c.LastName LIKE @search OR
        c.Email LIKE @search OR
        s.TrackingNumber LIKE @search OR
        o.ShippingCity LIKE @search OR
        o.ShippingRecipientName LIKE @search
      )`;
    }

    query += `
      GROUP BY 
        o.OrderID, f.Status, o.Status, o.CreatedAt, f.UpdatedAt, o.UpdatedAt,
        o.OrderNumber, c.CustomerID, c.FirstName, c.LastName, c.Email, c.PhoneNumber,
        o.ShippingRecipientName, o.ShippingCity, o.ShippingState, o.ShippingPostalCode
      ORDER BY o.OrderID DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY;
    `;

    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);

    const result = await request.query(query);
    const totalCount = result.recordset.length > 0 ? Number(result.recordset[0].TotalCount) : 0;

    return {
      items: result.recordset.map((row) => ({
        ...row,
        SellerOrderID: String(row.SellerOrderID),
        OrderID: String(row.OrderID),
        CustomerID: String(row.CustomerID),
        FulfillmentID: row.FulfillmentID ? String(row.FulfillmentID) : null,
        WarehouseID: row.WarehouseID ? String(row.WarehouseID) : null,
        ShipmentID: row.ShipmentID ? String(row.ShipmentID) : null,
      })),
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * Retrieves detailed single order breakdown including items, recipient address, and tracking events.
   */
  async getOrderDetail(sellerId: bigint | number, sellerOrderId: bigint | number) {
    const pool = await getPool();

    // 1. Order Header with Enriched Logistics, Seller, and Tax Origin
    const headerResult = await pool
      .request()
      .input('sellerOrderId', sql.BigInt, sellerOrderId)
      .input('sellerId', sql.BigInt, sellerId)
      .query(`
        SELECT 
          o.OrderID AS SellerOrderID,
          o.OrderID,
          @sellerId AS SellerID,
          COALESCE(f.Status, o.Status) AS SellerOrderStatus,
          o.CreatedAt AS OrderPlacedAt,
          COALESCE(f.UpdatedAt, o.UpdatedAt, o.CreatedAt) AS OrderUpdatedAt,
          o.OrderNumber,
          o.Status AS MasterOrderStatus,
          o.SubtotalAmount,
          o.DiscountAmount,
          o.ShippingAmount,
          o.TaxAmount,
          o.TotalAmount,
          c.CustomerID,
          c.FirstName AS CustomerFirstName,
          c.LastName AS CustomerLastName,
          c.Email AS CustomerEmail,
          c.PhoneNumber AS CustomerPhone,
          o.ShippingRecipientName,
          o.ShippingAddressLine1,
          o.ShippingAddressLine2,
          o.ShippingCity,
          o.ShippingState,
          o.ShippingPostalCode,
          o.ShippingCountry,
          o.ShippingPhoneNumber AS ShippingPhone,
          o.BillingRecipientName,
          o.BillingAddressLine1,
          o.BillingAddressLine2,
          o.BillingCity,
          o.BillingState,
          o.BillingPostalCode,
          o.BillingPhoneNumber AS BillingPhone,
          o.InvoiceGSTIN,
          o.PlaceOfSupplyStateCode,
          s_sm.gst_state_code AS CustomerGSTCode,
          s_sm.state_name AS CustomerStateStandardName,
          f.FulfillmentID,
          COALESCE(f.WarehouseID, def_wh.WarehouseID) AS WarehouseID,
          COALESCE(w.WarehouseName, def_wh.WarehouseName) AS WarehouseName,
          COALESCE(w.WarehouseCode, def_wh.WarehouseCode) AS WarehouseCode,
          COALESCE(w.AddressLine1, def_wh.AddressLine1) AS WarehouseAddressLine1,
          COALESCE(w.AddressLine2, def_wh.AddressLine2) AS WarehouseAddressLine2,
          COALESCE(w.City, def_wh.City) AS WarehouseCity,
          COALESCE(w.State, def_wh.State) AS WarehouseState,
          COALESCE(w.PostalCode, def_wh.PostalCode) AS WarehousePostalCode,
          COALESCE(w.ContactPhoneNumber, def_wh.ContactPhoneNumber) AS WarehousePhone,
          COALESCE(w.ContactEmail, def_wh.ContactEmail) AS WarehouseEmail,
          w_sm.gst_state_code AS WarehouseGSTCode,
          w_sm.state_name AS WarehouseStateStandardName,
          s.SellerName,
          s.BusinessName AS SellerBusinessName,
          s.Email AS SellerEmail,
          s.PhoneNumber AS SellerPhone,
          seller_docs.SellerPAN,
          seller_docs.SellerGSTIN,
          sh.ShipmentID,
          sh.Carrier,
          sh.TrackingNumber,
          sh.Status AS ShipmentStatus,
          sh.PackageWeight,
          sh.PackageLength,
          sh.PackageWidth,
          sh.PackageHeight,
          sh.EstimatedDeliveryDate,
          sh.ShippedAt,
          sh.DeliveredAt,
          inv.InvoiceID,
          inv.InvoiceNumber,
          inv.InvoiceDate,
          inv.TotalAmount AS InvoiceTotalAmount,
          inv.CGSTAmount AS InvoiceCGSTAmount,
          inv.SGSTAmount AS InvoiceSGSTAmount,
          inv.IGSTAmount AS InvoiceIGSTAmount
        FROM dbo.Orders o
        JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
        JOIN dbo.Sellers s ON s.SellerID = @sellerId
        LEFT JOIN dbo.state_master s_sm ON (LOWER(o.ShippingState) = LOWER(s_sm.state_name) OR UPPER(o.ShippingState) = s_sm.state_code)
        LEFT JOIN dbo.Fulfillments f ON o.OrderID = f.OrderID AND f.SellerID = @sellerId
        LEFT JOIN dbo.Warehouses w ON f.WarehouseID = w.WarehouseID
        OUTER APPLY (
          SELECT TOP 1 wh.*
          FROM dbo.SellerWarehouses sw
          JOIN dbo.Warehouses wh ON sw.WarehouseID = wh.WarehouseID
          WHERE sw.SellerID = @sellerId
          ORDER BY sw.IsPrimary DESC, sw.SellerWarehouseID ASC
        ) def_wh
        LEFT JOIN dbo.state_master w_sm ON (
          LOWER(COALESCE(w.State, def_wh.State)) = LOWER(w_sm.state_name) OR 
          UPPER(COALESCE(w.State, def_wh.State)) = w_sm.state_code
        )
        LEFT JOIN dbo.Shipments sh ON f.FulfillmentID = sh.FulfillmentID
        LEFT JOIN dbo.Invoices inv ON f.FulfillmentID = inv.FulfillmentID
        OUTER APPLY (
          SELECT 
            MAX(CASE WHEN dt.Code = 'PAN' THEN sad.CertificateNumber END) AS SellerPAN,
            MAX(CASE WHEN dt.Code = 'GST' THEN sad.CertificateNumber END) AS SellerGSTIN
          FROM dbo.SellerApplications sa_app
          JOIN dbo.SellerApplicationDocuments sad ON sa_app.SellerApplicationID = sad.SellerApplicationID
          JOIN dbo.DocumentTypes dt ON sad.DocumentTypeID = dt.DocumentTypeID
          WHERE sa_app.SellerID = @sellerId
        ) AS seller_docs
        WHERE o.OrderID = @sellerOrderId
          AND EXISTS (
            SELECT 1 FROM dbo.OrderItems oi_chk
            JOIN dbo.SellerProducts sp_chk ON oi_chk.SellerProductID = sp_chk.SellerProductID
            WHERE oi_chk.OrderID = o.OrderID AND sp_chk.SellerID = @sellerId
          );
      `);

    if (headerResult.recordset.length === 0) {
      return null;
    }

    const header = headerResult.recordset[0];

    // 2. Order Line Items for this seller with HSNCode and GSTRate
    const itemsResult = await pool
      .request()
      .input('orderId', sql.BigInt, header.OrderID)
      .input('sellerId', sql.BigInt, sellerId)
      .query(`
        SELECT 
          oi.OrderItemID,
          oi.SellerProductID,
          oi.Quantity,
          oi.UnitPrice,
          oi.MRP,
          oi.TotalMRP,
          oi.PurchasePrice,
          oi.DiscountPercentage,
          oi.DiscountAmount,
          oi.CGSTRate,
          oi.CGSTAmount,
          oi.SGSTRate,
          oi.SGSTAmount,
          oi.IGSTRate,
          oi.IGSTAmount,
          oi.TaxAmount,
          oi.TotalAmount,
          sp.SellerSKU,
          pv.VariantSKU,
          pm.ProductID,
          pm.ProductName,
          pm.ProductName AS ProductTitle,
          pm.HSNCode,
          pm.GSTRate,
          b.BrandName
        FROM dbo.OrderItems oi
        JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
        LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
        LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
        LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
        WHERE oi.OrderID = @orderId;
      `);

    return {
      order: {
        ...header,
        SellerOrderID: String(header.SellerOrderID),
        OrderID: String(header.OrderID),
        CustomerID: String(header.CustomerID),
        FulfillmentID: header.FulfillmentID ? String(header.FulfillmentID) : null,
        WarehouseID: header.WarehouseID ? String(header.WarehouseID) : null,
        ShipmentID: header.ShipmentID ? String(header.ShipmentID) : null,
        InvoiceID: header.InvoiceID ? String(header.InvoiceID) : null,
      },
      items: itemsResult.recordset.map((item) => ({
        ...item,
        OrderItemID: String(item.OrderItemID),
        SellerProductID: String(item.SellerProductID),
        ProductID: String(item.ProductID),
      })),
    };
  }

  /**
   * Generates or retrieves a persistent Tax Invoice record for an order.
   * Enforces sequential Invoice Number format: INV2627100000+
   * Dynamically calculates CGST/SGST (Intra-state) vs IGST (Inter-state).
   */
  async getOrCreateInvoice(sellerId: bigint | number, sellerOrderId: bigint | number) {
    const pool = await getPool();
    const detail = await this.getOrderDetail(sellerId, sellerOrderId);
    if (!detail) {
      throw new Error('Order not found');
    }

    const { order, items } = detail;

    // Check if Invoices record already exists in database for this order
    const existingInv = await pool.request()
      .input('orderId', sql.BigInt, order.OrderID)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Invoices
        WHERE OrderID = @orderId
        ORDER BY InvoiceID DESC
      `);

    // Determine Intra-state vs Inter-state using official GST state codes
    const warehouseGstCode = order.WarehouseGSTCode ? String(order.WarehouseGSTCode).trim() : '';
    const customerGstCode = order.CustomerGSTCode ? String(order.CustomerGSTCode).trim() : '';
    const isIntraState = Boolean(
      (warehouseGstCode && customerGstCode && warehouseGstCode === customerGstCode) ||
      (!warehouseGstCode && !customerGstCode && order.WarehouseState && order.ShippingState &&
       order.WarehouseState.trim().toLowerCase() === order.ShippingState.trim().toLowerCase())
    );

    let totalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const calculatedItems = items.map((item: any) => {
      const qty = Number(item.Quantity) || 1;
      const unitPrice = Number(item.UnitPrice) || 0;
      const lineTotal = Number((unitPrice * qty).toFixed(2));
      const gstRate = Number(item.GSTRate) || 0;

      let lineTaxable = lineTotal;
      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (gstRate > 0) {
        lineTaxable = Number((lineTotal / (1 + gstRate / 100)).toFixed(2));
        const lineGst = Number((lineTotal - lineTaxable).toFixed(2));

        if (isIntraState) {
          cgstRate = gstRate / 2;
          sgstRate = gstRate / 2;
          cgstAmount = Number((lineGst / 2).toFixed(2));
          sgstAmount = Number((lineGst - cgstAmount).toFixed(2));
        } else {
          igstRate = gstRate;
          igstAmount = lineGst;
        }
      }

      totalTaxable += lineTaxable;
      totalCGST += cgstAmount;
      totalSGST += sgstAmount;
      totalIGST += igstAmount;

      return {
        ...item,
        lineTaxable,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        lineTotal,
        isIntraState,
      };
    });

    // In retail e-commerce, UnitPrice is GST inclusive.
    // Ensure sum(Taxable) + sum(GST) exactly equals sum(lineTotal).
    const sumLineTotals = Number(items.reduce((acc: number, it: any) => acc + (Number(it.UnitPrice) * Number(it.Quantity)), 0).toFixed(2));
    const totalTax = Number((totalCGST + totalSGST + totalIGST).toFixed(2));
    const subtotalAmount = Number((sumLineTotals - totalTax).toFixed(2));

    const couponDiscount = Number(order.DiscountAmount) || 0;
    const shippingAmount = Number(order.ShippingAmount) || 0;

    // Grand total matches order total paid exactly
    const calculatedGrandTotal = Number((sumLineTotals - couponDiscount + shippingAmount).toFixed(2));
    const grandTotal = Number(order.TotalAmount) ? Number(Number(order.TotalAmount).toFixed(2)) : calculatedGrandTotal;

    if (existingInv.recordset.length > 0) {
      const invRow = existingInv.recordset[0];

      // Sync stored invoice totals if not matching grandTotal
      if (Math.abs(Number(invRow.TotalAmount) - grandTotal) > 0.01 || Math.abs(Number(invRow.TaxAmount) - totalTax) > 0.01) {
        await pool.request()
          .input('invId', sql.BigInt, invRow.InvoiceID)
          .input('subtotal', sql.Decimal(18, 2), subtotalAmount)
          .input('discount', sql.Decimal(18, 2), couponDiscount)
          .input('shipping', sql.Decimal(18, 2), shippingAmount)
          .input('cgst', sql.Decimal(18, 2), totalCGST)
          .input('sgst', sql.Decimal(18, 2), totalSGST)
          .input('igst', sql.Decimal(18, 2), totalIGST)
          .input('taxAmount', sql.Decimal(18, 2), totalTax)
          .input('total', sql.Decimal(18, 2), grandTotal)
          .query(`
            UPDATE dbo.Invoices
            SET SubtotalAmount = @subtotal,
                DiscountAmount = @discount,
                ShippingAmount = @shipping,
                CGSTAmount = @cgst,
                SGSTAmount = @sgst,
                IGSTAmount = @igst,
                TaxAmount = @taxAmount,
                TotalAmount = @total
            WHERE InvoiceID = @invId;
          `);
        invRow.SubtotalAmount = subtotalAmount;
        invRow.DiscountAmount = couponDiscount;
        invRow.ShippingAmount = shippingAmount;
        invRow.CGSTAmount = totalCGST;
        invRow.SGSTAmount = totalSGST;
        invRow.IGSTAmount = totalIGST;
        invRow.TotalAmount = grandTotal;
      }

      await this.ensureInvoiceItems(pool, BigInt(invRow.InvoiceID), calculatedItems);

      return {
        ...detail,
        order: {
          ...order,
          InvoiceID: String(invRow.InvoiceID),
          InvoiceNumber: invRow.InvoiceNumber,
          InvoiceDate: invRow.InvoiceDate,
          InvoiceTotalAmount: Number(invRow.TotalAmount),
        },
        items: calculatedItems,
        invoice: {
          invoiceId: String(invRow.InvoiceID),
          invoiceNumber: invRow.InvoiceNumber,
          invoiceDate: invRow.InvoiceDate,
          subtotalAmount: Number(invRow.SubtotalAmount),
          discountAmount: Number(invRow.DiscountAmount || 0),
          shippingAmount: Number(invRow.ShippingAmount || 0),
          cgstAmount: Number(invRow.CGSTAmount || 0),
          sgstAmount: Number(invRow.SGSTAmount || 0),
          igstAmount: Number(invRow.IGSTAmount || 0),
          totalAmount: Number(invRow.TotalAmount),
          isIntraState,
        },
      };
    }

    // Sequence Generator starting at 100000 (1 Lakh) -> INV2627100000+
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'InvoiceNumberSeq')
      BEGIN
        CREATE SEQUENCE dbo.InvoiceNumberSeq START WITH 100000 INCREMENT BY 1;
      END
    `);

    const seqRes = await pool.request().query<{ nextSeq: number | string }>(`
      SELECT NEXT VALUE FOR dbo.InvoiceNumberSeq AS nextSeq;
    `);

    const nextSeq = seqRes.recordset[0]?.nextSeq || (100000 + Math.floor(Math.random() * 899999));
    const invoiceNumber = `INV2627${nextSeq}`;

    // Ensure fulfillment ID
    let fulfillmentId = order.FulfillmentID;
    if (!fulfillmentId) {
      const fulCheck = await pool.request()
        .input('orderId', sql.BigInt, order.OrderID)
        .input('sellerId', sql.BigInt, sellerId)
        .query<{ FulfillmentID: bigint }>(`
          SELECT TOP 1 FulfillmentID FROM dbo.Fulfillments WHERE OrderID = @orderId AND SellerID = @sellerId
        `);
      if (fulCheck.recordset.length > 0) {
        fulfillmentId = String(fulCheck.recordset[0].FulfillmentID);
      } else {
        const createFul = await pool.request()
          .input('orderId', sql.BigInt, order.OrderID)
          .input('sellerId', sql.BigInt, sellerId)
          .input('warehouseId', sql.BigInt, order.WarehouseID || 1)
          .query<{ FulfillmentID: bigint }>(`
            INSERT INTO dbo.Fulfillments (OrderID, SellerID, WarehouseID, Status, CreatedAt)
            OUTPUT INSERTED.FulfillmentID
            VALUES (@orderId, @sellerId, @warehouseId, 'CONFIRMED', SYSUTCDATETIME());
          `);
        fulfillmentId = String(createFul.recordset[0].FulfillmentID);
      }
    }

    // Insert into dbo.Invoices
    const insertRes = await pool.request()
      .input('invoiceNumber', sql.VarChar(50), invoiceNumber)
      .input('fulfillmentId', sql.BigInt, fulfillmentId)
      .input('orderId', sql.BigInt, order.OrderID)
      .input('sellerId', sql.BigInt, sellerId)
      .input('customerId', sql.BigInt, order.CustomerID)
      .input('subtotal', sql.Decimal(18, 2), Number(subtotalAmount.toFixed(2)))
      .input('discount', sql.Decimal(18, 2), Number(couponDiscount.toFixed(2)))
      .input('shipping', sql.Decimal(18, 2), Number(shippingAmount.toFixed(2)))
      .input('cgst', sql.Decimal(18, 2), Number(totalCGST.toFixed(2)))
      .input('sgst', sql.Decimal(18, 2), Number(totalSGST.toFixed(2)))
      .input('igst', sql.Decimal(18, 2), Number(totalIGST.toFixed(2)))
      .input('taxAmount', sql.Decimal(18, 2), Number(totalTax.toFixed(2)))
      .input('total', sql.Decimal(18, 2), grandTotal)
      .input('status', sql.VarChar(20), 'GENERATED')
      .query<{ InvoiceID: bigint }>(`
        INSERT INTO dbo.Invoices (
          InvoiceNumber, FulfillmentID, OrderID, SellerID, CustomerID,
          InvoiceDate, SubtotalAmount, DiscountAmount, ShippingAmount,
          CGSTAmount, SGSTAmount, IGSTAmount, TaxAmount, TotalAmount,
          Status, CreatedAt, CreatedBy
        )
        OUTPUT INSERTED.InvoiceID
        VALUES (
          @invoiceNumber, @fulfillmentId, @orderId, @sellerId, @customerId,
          SYSUTCDATETIME(), @subtotal, @discount, @shipping,
          @cgst, @sgst, @igst, @taxAmount, @total,
          @status, SYSUTCDATETIME(), @sellerId
        );
      `);

    const newInvoiceId = String(insertRes.recordset[0].InvoiceID);
    const invoiceDate = new Date().toISOString();

    await this.ensureInvoiceItems(pool, BigInt(newInvoiceId), calculatedItems);

    return {
      order: {
        ...order,
        InvoiceID: newInvoiceId,
        InvoiceNumber: invoiceNumber,
        InvoiceDate: invoiceDate,
        InvoiceTotalAmount: grandTotal,
      },
      items: calculatedItems,
      invoice: {
        invoiceId: newInvoiceId,
        invoiceNumber,
        invoiceDate,
        subtotalAmount,
        discountAmount: couponDiscount,
        shippingAmount,
        cgstAmount: totalCGST,
        sgstAmount: totalSGST,
        igstAmount: totalIGST,
        totalAmount: grandTotal,
        isIntraState,
      },
    };
  }

  private async ensureInvoiceItems(pool: any, invoiceId: bigint, items: any[]) {
    try {
      const existingItems = await pool
        .request()
        .input('invId', sql.BigInt, invoiceId)
        .query('SELECT COUNT(1) AS cnt FROM dbo.InvoiceItems WHERE InvoiceID = @invId');

      if (existingItems.recordset[0]?.cnt === 0) {
        for (const item of items) {
          const prodName = String(item.ProductTitle || item.ProductName || 'Merchandise Item').slice(0, 255);
          const qty = Number(item.Quantity) || 1;
          const unitPrice = Number(item.UnitPrice) || 0;
          const mrp = Number(item.MRP) || unitPrice;
          const totalMrp = Number(item.TotalMRP) || (mrp * qty);
          const discPct = Number(item.DiscountPercentage) || 0;
          const discAmt = Number(item.DiscountAmount) || 0;
          const taxableAmt = Number(item.lineTaxable) || Math.max(0, unitPrice * qty - discAmt);
          const cgstRate = Number(item.cgstRate) || 0;
          const cgstAmt = Number(item.cgstAmount) || 0;
          const sgstRate = Number(item.sgstRate) || 0;
          const sgstAmt = Number(item.sgstAmount) || 0;
          const igstRate = Number(item.igstRate) || 0;
          const igstAmt = Number(item.igstAmount) || 0;
          const taxAmt = Number((cgstAmt + sgstAmt + igstAmt).toFixed(2));
          const totalAmt = Number(item.lineTotal) || Number((taxableAmt + taxAmt).toFixed(2));

          await pool
            .request()
            .input('invId', sql.BigInt, invoiceId)
            .input('orderItemId', sql.BigInt, item.OrderItemID)
            .input('prodName', sql.NVarChar(255), prodName)
            .input('qty', sql.Int, qty)
            .input('mrp', sql.Decimal(18, 2), mrp)
            .input('totalMrp', sql.Decimal(18, 2), totalMrp)
            .input('unitPrice', sql.Decimal(18, 2), unitPrice)
            .input('discPct', sql.Decimal(5, 2), discPct)
            .input('discAmt', sql.Decimal(18, 2), discAmt)
            .input('taxableAmt', sql.Decimal(18, 2), taxableAmt)
            .input('cgstRate', sql.Decimal(5, 2), cgstRate)
            .input('cgstAmt', sql.Decimal(18, 2), cgstAmt)
            .input('sgstRate', sql.Decimal(5, 2), sgstRate)
            .input('sgstAmt', sql.Decimal(18, 2), sgstAmt)
            .input('igstRate', sql.Decimal(5, 2), igstRate)
            .input('igstAmt', sql.Decimal(18, 2), igstAmt)
            .input('taxAmt', sql.Decimal(18, 2), taxAmt)
            .input('totalAmt', sql.Decimal(18, 2), totalAmt)
            .query(`
              INSERT INTO dbo.InvoiceItems (
                InvoiceID, OrderItemID, ProductName, Quantity, MRP, TotalMRP,
                UnitPrice, DiscountPercentage, DiscountAmount, TaxableAmount,
                CGSTRate, CGSTAmount, SGSTRate, SGSTAmount, IGSTRate, IGSTAmount,
                TaxAmount, TotalAmount, CreatedAt
              )
              VALUES (
                @invId, @orderItemId, @prodName, @qty, @mrp, @totalMrp,
                @unitPrice, @discPct, @discAmt, @taxableAmt,
                @cgstRate, @cgstAmt, @sgstRate, @sgstAmt, @igstRate, @igstAmt,
                @taxAmt, @totalAmt, SYSUTCDATETIME()
              );
            `);
        }
      }
    } catch (e: any) {
      console.warn('Could not populate dbo.InvoiceItems:', e.message);
    }
  }

  /**
   * Updates Seller Order status (e.g. PROCESSING, READY_TO_SHIP, DELIVERED).
   */
  async updateOrderStatus(
    sellerId: bigint | number,
    sellerOrderId: bigint | number,
    newStatus: string
  ) {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('sellerOrderId', sql.BigInt, sellerOrderId)
      .input('sellerId', sql.BigInt, sellerId)
      .input('newStatus', sql.VarChar, newStatus)
      .query(`
        UPDATE dbo.Orders
        SET Status = @newStatus,
            UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.OrderID AS SellerOrderID, INSERTED.Status, INSERTED.UpdatedAt
        WHERE OrderID = @sellerOrderId
          AND EXISTS (
            SELECT 1 FROM dbo.OrderItems oi
            JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
            WHERE oi.OrderID = dbo.Orders.OrderID AND sp.SellerID = @sellerId
          );
      `);

    if (result.recordset.length === 0) {
      throw new Error('Seller order not found or access denied');
    }

    // Senior Engineer Pattern: Release active inventory reservations if order is cancelled
    if (newStatus === 'CANCELLED') {
      await pool
        .request()
        .input('orderId', sql.BigInt, sellerOrderId)
        .query(`
          -- 1. Deduct ReservedQuantity on Inventory for any still-reserved items
          UPDATE inv
          SET inv.ReservedQuantity = CASE WHEN inv.ReservedQuantity >= ir.Quantity THEN inv.ReservedQuantity - ir.Quantity ELSE 0 END,
              inv.UpdatedAt = SYSUTCDATETIME()
          FROM dbo.Inventory inv
          JOIN dbo.InventoryReservations ir ON inv.InventoryID = ir.InventoryID
          WHERE ir.OrderID = @orderId AND ir.Status = 'RESERVED';

          -- 2. Audit Ledger row
          INSERT INTO dbo.InventoryTransactions (
            InventoryID, OrderID, TransactionType, Quantity, Reason, CreatedAt
          )
          SELECT ir.InventoryID, @orderId, 'RESERVATION_RELEASED', ir.Quantity, 'Order cancelled by seller/admin', SYSUTCDATETIME()
          FROM dbo.InventoryReservations ir
          WHERE ir.OrderID = @orderId AND ir.Status = 'RESERVED';

          -- 3. Transition reservation status
          UPDATE dbo.InventoryReservations
          SET Status = 'CANCELLED', UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND Status = 'RESERVED';
        `);
    }

    return result.recordset[0];
  }

  /**
   * Dispatches shipment by creating or updating dbo.Shipments and setting status to 'SHIPPED'.
   */
  async createOrUpdateShipment(
    sellerId: bigint | number,
    sellerOrderId: bigint | number,
    shipmentData: ShipmentUpdateData
  ) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Fetch order and fulfillment
      const orderRes = await transaction
        .request()
        .input('sellerOrderId', sql.BigInt, sellerOrderId)
        .input('sellerId', sql.BigInt, sellerId)
        .query(`
          SELECT 
            o.OrderID,
            f.FulfillmentID, 
            f.WarehouseID
          FROM dbo.Orders o
          LEFT JOIN dbo.Fulfillments f ON o.OrderID = f.OrderID AND f.SellerID = @sellerId
          WHERE o.OrderID = @sellerOrderId
            AND EXISTS (
              SELECT 1 FROM dbo.OrderItems oi
              JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
              WHERE oi.OrderID = o.OrderID AND sp.SellerID = @sellerId
            );
        `);

      if (orderRes.recordset.length === 0) {
        throw new Error('Seller order not found');
      }

      const { OrderID, FulfillmentID, WarehouseID } = orderRes.recordset[0];
      let activeFulfillmentId = FulfillmentID;

      // If fulfillment row doesn't exist yet, create one
      if (!activeFulfillmentId) {
        // Find default warehouse for seller if not set
        const whRes = await transaction
          .request()
          .input('sellerId', sql.BigInt, sellerId)
          .query(`
            SELECT TOP 1 WarehouseID 
            FROM dbo.SellerWarehouses 
            WHERE SellerID = @sellerId AND Status = 'APPROVED'
          `);

        const warehouseIdToUse = WarehouseID || whRes.recordset[0]?.WarehouseID || 1;

        const createFulfillment = await transaction
          .request()
          .input('orderId', sql.BigInt, OrderID)
          .input('sellerId', sql.BigInt, sellerId)
          .input('whId', sql.BigInt, warehouseIdToUse)
          .query(`
            INSERT INTO dbo.Fulfillments (OrderID, SellerID, WarehouseID, Status, CreatedAt)
            OUTPUT INSERTED.FulfillmentID
            VALUES (@orderId, @sellerId, @whId, 'SHIPPED', SYSUTCDATETIME())
          `);
        activeFulfillmentId = createFulfillment.recordset[0].FulfillmentID;
      }

      // 2. Check if shipment already exists
      const shipCheck = await transaction
        .request()
        .input('fId', sql.BigInt, activeFulfillmentId)
        .query(`
          SELECT ShipmentID FROM dbo.Shipments WHERE FulfillmentID = @fId
        `);

      let shipmentId: bigint;

      if (shipCheck.recordset.length === 0) {
        const insertShip = await transaction
          .request()
          .input('fId', sql.BigInt, activeFulfillmentId)
          .input('carrier', sql.NVarChar, shipmentData.carrier)
          .input('trackNo', sql.NVarChar, shipmentData.trackingNumber)
          .input('weight', sql.Decimal(10, 3), shipmentData.packageWeight || 0.5)
          .input('length', sql.Decimal(10, 2), shipmentData.packageLength || 10)
          .input('width', sql.Decimal(10, 2), shipmentData.packageWidth || 10)
          .input('height', sql.Decimal(10, 2), shipmentData.packageHeight || 10)
          .input('estDelivery', sql.DateTime2, shipmentData.estimatedDeliveryDate ? new Date(shipmentData.estimatedDeliveryDate) : null)
          .query(`
            INSERT INTO dbo.Shipments (
              FulfillmentID, Carrier, TrackingNumber, Status, PackageWeight,
              PackageLength, PackageWidth, PackageHeight, EstimatedDeliveryDate,
              ShippedAt, CreatedAt
            )
            OUTPUT INSERTED.ShipmentID
            VALUES (
              @fId, @carrier, @trackNo, 'SHIPPED', @weight,
              @length, @width, @height, @estDelivery,
              SYSUTCDATETIME(), SYSUTCDATETIME()
            )
          `);
        shipmentId = BigInt(insertShip.recordset[0].ShipmentID);
      } else {
        shipmentId = BigInt(shipCheck.recordset[0].ShipmentID);
        await transaction
          .request()
          .input('shipId', sql.BigInt, shipmentId)
          .input('carrier', sql.NVarChar, shipmentData.carrier)
          .input('trackNo', sql.NVarChar, shipmentData.trackingNumber)
          .input('weight', sql.Decimal(10, 3), shipmentData.packageWeight || 0.5)
          .input('estDelivery', sql.DateTime2, shipmentData.estimatedDeliveryDate ? new Date(shipmentData.estimatedDeliveryDate) : null)
          .query(`
            UPDATE dbo.Shipments
            SET Carrier = @carrier,
                TrackingNumber = @trackNo,
                PackageWeight = @weight,
                Status = 'SHIPPED',
                EstimatedDeliveryDate = @estDelivery,
                ShippedAt = SYSUTCDATETIME(),
                UpdatedAt = SYSUTCDATETIME()
            WHERE ShipmentID = @shipId
          `);
      }

      // 3. Update Order and Fulfillment status to SHIPPED / DISPATCHED
      await transaction
        .request()
        .input('orderId', sql.BigInt, OrderID)
        .input('sellerId', sql.BigInt, sellerId)
        .query(`
          UPDATE dbo.Orders
          SET Status = 'SHIPPED',
              UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId;

          UPDATE dbo.Fulfillments
          SET Status = 'DISPATCHED',
              UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND SellerID = @sellerId;
        `);

      await transaction.commit();

      return {
        shipmentId: String(shipmentId),
        fulfillmentId: String(activeFulfillmentId),
        status: 'SHIPPED',
        carrier: shipmentData.carrier,
        trackingNumber: shipmentData.trackingNumber,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}

export const ordersRepository = new OrdersRepository();

import { getPool, sql } from '../../database/db.js';

export interface AdminOrdersSummary {
  totalOrders: number;
  totalGmv: number;
  activeOrders: number;
  pendingPayments: number;
  cancelledOrders: number;
}

export interface AdminOrderListItem {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  totalAmount: number;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  createdAt: Date;
  updatedAt: Date | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  itemsCount: number;
  firstProductImage: string | null;
  firstProductName: string | null;
  paymentStatus: string | null;
  paymentModeName: string | null;
  paymentModeCode: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPincode?: string | null;
}

export interface AdminFulfillmentListItem {
  fulfillmentId: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  fulfillmentStatus: string;
  createdAt: Date;
  updatedAt: Date | null;
  sellerId: string;
  sellerName: string;
  sellerCode: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  carrier: string | null;
  trackingNumber: string | null;
  shipmentStatus: string | null;
  itemsCount: number;
}

export interface AdminPaymentListItem {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  paymentStatus: string;
  gatewayReference: string | null;
  paidAt: Date | null;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
  paymentModeName: string;
  paymentModeCode: string;
  paymentModeType: string;
}

export interface AdminCancelledOrderListItem {
  orderId: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  cancelledAt: Date | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  cancelledBy: string | null;
  reason: string | null;
  refundStatus: string | null;
}

export class AdminOrdersRepository {
  /**
   * Retrieves high-level aggregated metrics across all master orders.
   */
  async getOrdersSummary(): Promise<AdminOrdersSummary> {
    const pool = await getPool();
    const result = await pool.request().query<{
      TotalOrders: number;
      TotalGmv: number;
      ActiveOrders: number;
      PendingPayments: number;
      CancelledOrders: number;
    }>(`
      SELECT 
        COUNT(1) AS TotalOrders,
        ISNULL(SUM(CASE WHEN Status != 'CANCELLED' THEN TotalAmount ELSE 0 END), 0) AS TotalGmv,
        ISNULL(SUM(CASE WHEN Status IN ('CONFIRMED', 'ALLOCATED', 'PACKED', 'SHIPPED') THEN 1 ELSE 0 END), 0) AS ActiveOrders,
        ISNULL(SUM(CASE WHEN Status = 'PENDING' THEN 1 ELSE 0 END), 0) AS PendingPayments,
        ISNULL(SUM(CASE WHEN Status IN ('CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED') THEN 1 ELSE 0 END), 0) AS CancelledOrders
      FROM dbo.Orders;
    `);

    const row = result.recordset[0];
    return {
      totalOrders: Number(row?.TotalOrders || 0),
      totalGmv: Number(row?.TotalGmv || 0),
      activeOrders: Number(row?.ActiveOrders || 0),
      pendingPayments: Number(row?.PendingPayments || 0),
      cancelledOrders: Number(row?.CancelledOrders || 0),
    };
  }

  /**
   * Retrieves paginated master orders with filtering by search query, status, and dates.
   */
  async getOrdersList(params: {
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }): Promise<{ items: AdminOrderListItem[]; total: number }> {
    const pool = await getPool();
    const req = pool.request();
    const whereClauses: string[] = ['1=1'];

    if (params.status && params.status.trim() !== '') {
      req.input('status', sql.VarChar(30), params.status.trim());
      whereClauses.push('o.Status = @status');
    }

    if (params.search && params.search.trim() !== '') {
      req.input('search', sql.NVarChar(150), `%${params.search.trim()}%`);
      whereClauses.push(
        `(o.OrderNumber LIKE @search OR c.FirstName LIKE @search OR c.LastName LIKE @search OR c.Email LIKE @search OR c.PhoneNumber LIKE @search)`
      );
    }

    if (params.startDate) {
      req.input('startDate', sql.DateTime2, params.startDate);
      whereClauses.push('o.CreatedAt >= @startDate');
    }

    if (params.endDate) {
      req.input('endDate', sql.DateTime2, params.endDate);
      whereClauses.push('o.CreatedAt <= @endDate');
    }

    const whereSql = whereClauses.join(' AND ');
    const offset = (params.page - 1) * params.limit;
    req.input('offset', sql.Int, offset);
    req.input('limit', sql.Int, params.limit);

    const query = `
      SELECT 
        o.OrderID,
        o.OrderNumber,
        o.Status AS OrderStatus,
        o.TotalAmount,
        o.SubtotalAmount,
        o.TaxAmount,
        o.ShippingAmount,
        o.DiscountAmount,
        o.CreatedAt,
        o.UpdatedAt,
        o.ShippingCity,
        o.ShippingState,
        o.ShippingPostalCode,
        c.CustomerID,
        CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
        c.Email AS CustomerEmail,
        c.PhoneNumber AS CustomerPhone,
        (SELECT COUNT(1) FROM dbo.OrderItems oi WHERE oi.OrderID = o.OrderID) AS ItemsCount,
        (
          SELECT TOP 1 COALESCE(
            (
              SELECT TOP 1 pa.AssetURL
              FROM dbo.ProductVariantAssets pva
              JOIN dbo.ProductAssets pa ON pva.ProductAssetID = pa.ProductAssetID
              WHERE pva.ProductVariantID = ISNULL(sp2.ProductVariantID, pv2.ProductVariantID)
              ORDER BY pva.IsVariantCover DESC, pva.DisplayOrder ASC
            ),
            (
              SELECT TOP 1 pa.AssetURL
              FROM dbo.ProductAssets pa
              WHERE pa.ProductID = pm2.ProductID
              ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
            )
          )
          FROM dbo.OrderItems oi2
          JOIN dbo.SellerProducts sp2 ON oi2.SellerProductID = sp2.SellerProductID
          JOIN dbo.ProductVariants pv2 ON sp2.ProductVariantID = pv2.ProductVariantID
          LEFT JOIN dbo.ProductMaster pm2 ON pv2.ProductMasterID = pm2.ProductID
          WHERE oi2.OrderID = o.OrderID
        ) AS FirstProductImage,
        (
          SELECT TOP 1 pm2.ProductName
          FROM dbo.OrderItems oi2
          JOIN dbo.SellerProducts sp2 ON oi2.SellerProductID = sp2.SellerProductID
          JOIN dbo.ProductVariants pv2 ON sp2.ProductVariantID = pv2.ProductVariantID
          JOIN dbo.ProductMaster pm2 ON pv2.ProductMasterID = pm2.ProductID
          WHERE oi2.OrderID = o.OrderID
        ) AS FirstProductName,
        p.Status AS PaymentStatus,
        pm.PaymentModeName,
        pm.PaymentModeCode,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.Orders o
      JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
      LEFT JOIN dbo.Payments p ON o.OrderID = p.OrderID
      LEFT JOIN dbo.PaymentModes pm ON p.PaymentModeID = pm.PaymentModeID
      WHERE ${whereSql}
      ORDER BY o.CreatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await req.query(query);
    const total = result.recordset.length > 0 ? Number(result.recordset[0].TotalCount) : 0;

    const items: AdminOrderListItem[] = result.recordset.map((r) => ({
      orderId: String(r.OrderID),
      orderNumber: r.OrderNumber,
      orderStatus: r.OrderStatus,
      totalAmount: Number(r.TotalAmount),
      subtotalAmount: Number(r.SubtotalAmount),
      taxAmount: Number(r.TaxAmount),
      shippingAmount: Number(r.ShippingAmount),
      discountAmount: Number(r.DiscountAmount),
      createdAt: r.CreatedAt,
      updatedAt: r.UpdatedAt,
      customerId: String(r.CustomerID),
      customerName: r.CustomerName,
      customerEmail: r.CustomerEmail,
      customerPhone: r.CustomerPhone,
      itemsCount: Number(r.ItemsCount || 0),
      firstProductImage: r.FirstProductImage || null,
      firstProductName: r.FirstProductName || null,
      paymentStatus: r.PaymentStatus,
      paymentModeName: r.PaymentModeName,
      paymentModeCode: r.PaymentModeCode,
      shippingCity: r.ShippingCity || null,
      shippingState: r.ShippingState || null,
      shippingPincode: r.ShippingPostalCode || null,
    }));

    return { items, total };
  }

  /**
   * Retrieves complete order details including addresses, line items with taxes, fulfillments, and payments.
   */
  async getOrderDetail(orderId: bigint) {
    const pool = await getPool();

    // 1. Order master & customer
    const orderRes = await pool.request().input('orderId', sql.BigInt, orderId).query(`
      SELECT 
        o.OrderID,
        o.OrderNumber,
        o.Status,
        o.SubtotalAmount,
        o.DiscountAmount,
        o.ShippingAmount,
        o.TaxAmount,
        o.TotalAmount,
        o.ShippingRecipientName,
        o.ShippingPhoneNumber,
        o.ShippingAddressLine1,
        o.ShippingAddressLine2,
        o.ShippingCity,
        o.ShippingState,
        o.ShippingPostalCode,
        o.ShippingCountry,
        o.BillingRecipientName,
        o.BillingPhoneNumber,
        o.BillingAddressLine1,
        o.BillingAddressLine2,
        o.BillingCity,
        o.BillingState,
        o.BillingPostalCode,
        o.BillingCountry,
        o.InvoiceGSTIN,
        o.PlaceOfSupplyStateCode,
        o.CreatedAt,
        o.UpdatedAt,
        o.ShippingCity,
        o.ShippingState,
        o.ShippingPostalCode,
        c.CustomerID,
        CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
        c.Email AS CustomerEmail,
        c.PhoneNumber AS CustomerPhone
      FROM dbo.Orders o
      JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
      WHERE o.OrderID = @orderId;
    `);

    if (orderRes.recordset.length === 0) {
      return null;
    }
    const order = orderRes.recordset[0];

    // 2. Line Items with SKU, Variant, Seller, GST
    const itemsRes = await pool.request().input('orderId', sql.BigInt, orderId).query(`
      SELECT 
        oi.OrderItemID,
        oi.SellerProductID,
        oi.Quantity,
        oi.UnitPrice,
        oi.MRP,
        oi.TotalMRP,
        oi.DiscountAmount,
        oi.CGSTRate,
        oi.CGSTAmount,
        oi.SGSTRate,
        oi.SGSTAmount,
        oi.IGSTRate,
        oi.IGSTAmount,
        oi.TaxAmount,
        oi.TotalAmount,
        pm.ProductName,
        pv.VariantSKU,
        b.BrandName,
        s.SellerID,
        s.BusinessName AS SellerName,
        s.SellerCode,
        COALESCE(
          (
            SELECT TOP 1 pa.AssetURL
            FROM dbo.ProductVariantAssets pva
            JOIN dbo.ProductAssets pa ON pva.ProductAssetID = pa.ProductAssetID
            WHERE pva.ProductVariantID = ISNULL(sp.ProductVariantID, pv.ProductVariantID)
            ORDER BY pva.IsVariantCover DESC, pva.DisplayOrder ASC
          ),
          (
            SELECT TOP 1 pa.AssetURL
            FROM dbo.ProductAssets pa
            WHERE pa.ProductID = pm.ProductID
            ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
          )
        ) AS PrimaryImage
      FROM dbo.OrderItems oi
      JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
      JOIN dbo.Sellers s ON sp.SellerID = s.SellerID
      JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
      JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
      LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
      WHERE oi.OrderID = @orderId;
    `);

    // 3. Fulfillments and linked shipments
    const fulRes = await pool.request().input('orderId', sql.BigInt, orderId).query(`
      SELECT 
        f.FulfillmentID,
        f.Status AS FulfillmentStatus,
        f.CreatedAt,
        f.UpdatedAt,
        w.WarehouseID,
        w.WarehouseName,
        w.WarehouseCode,
        w.City AS WarehouseCity,
        w.State AS WarehouseState,
        s.SellerID,
        s.BusinessName AS SellerName,
        s.SellerCode,
        sh.ShipmentID,
        sh.Carrier,
        sh.TrackingNumber,
        sh.Status AS ShipmentStatus,
        sh.EstimatedDeliveryDate,
        sh.ShippedAt
      FROM dbo.Fulfillments f
      JOIN dbo.Warehouses w ON f.WarehouseID = w.WarehouseID
      JOIN dbo.Sellers s ON f.SellerID = s.SellerID
      LEFT JOIN dbo.Shipments sh ON f.FulfillmentID = sh.FulfillmentID
      WHERE f.OrderID = @orderId;
    `);

    // 4. Payment records
    const payRes = await pool.request().input('orderId', sql.BigInt, orderId).query(`
      SELECT 
        p.PaymentID,
        p.Amount,
        p.Status AS PaymentStatus,
        p.GatewayReference,
        p.PaidAt,
        p.CreatedAt,
        pm.PaymentModeName,
        pm.PaymentModeCode,
        pm.PaymentModeType
      FROM dbo.Payments p
      JOIN dbo.PaymentModes pm ON p.PaymentModeID = pm.PaymentModeID
      WHERE p.OrderID = @orderId;
    `);

    // 5. Timeline from OrderStatusHistory and events
    const historyRes = await pool.request().input('orderId', sql.BigInt, orderId).query(`
      SELECT 
        osh.OrderStatusHistoryID,
        osh.Status,
        osh.ChangedAt,
        osh.ChangedBy,
        u.FirstName,
        u.LastName
      FROM dbo.OrderStatusHistory osh
      LEFT JOIN dbo.Users u ON osh.ChangedBy = u.UserID
      WHERE osh.OrderID = @orderId
      ORDER BY osh.ChangedAt ASC;
    `);

    return {
      order: {
        orderId: String(order.OrderID),
        orderNumber: order.OrderNumber,
        status: order.Status,
        subtotalAmount: Number(order.SubtotalAmount),
        discountAmount: Number(order.DiscountAmount),
        shippingAmount: Number(order.ShippingAmount),
        taxAmount: Number(order.TaxAmount),
        totalAmount: Number(order.TotalAmount),
        invoiceGstin: order.InvoiceGSTIN,
        placeOfSupplyStateCode: order.PlaceOfSupplyStateCode,
        createdAt: order.CreatedAt,
        updatedAt: order.UpdatedAt,
      },
      customer: {
        customerId: String(order.CustomerID),
        name: order.CustomerName,
        email: order.CustomerEmail,
        phone: order.CustomerPhone,
      },
      shippingAddress: {
        recipientName: order.ShippingRecipientName,
        phone: order.ShippingPhoneNumber,
        addressLine1: order.ShippingAddressLine1,
        addressLine2: order.ShippingAddressLine2,
        city: order.ShippingCity,
        state: order.ShippingState,
        postalCode: order.ShippingPostalCode,
        country: order.ShippingCountry,
      },
      billingAddress: {
        recipientName: order.BillingRecipientName,
        phone: order.BillingPhoneNumber,
        addressLine1: order.BillingAddressLine1,
        addressLine2: order.BillingAddressLine2,
        city: order.BillingCity,
        state: order.BillingState,
        postalCode: order.BillingPostalCode,
        country: order.BillingCountry,
      },
      items: itemsRes.recordset.map((i) => ({
        orderItemId: String(i.OrderItemID),
        sellerProductId: String(i.SellerProductID),
        productName: i.ProductName,
        variantSku: i.VariantSKU,
        brandName: i.BrandName,
        sellerName: i.SellerName,
        sellerCode: i.SellerCode,
        primaryImage: i.PrimaryImage,
        quantity: Number(i.Quantity),
        unitPrice: Number(i.UnitPrice),
        mrp: Number(i.MRP),
        totalMrp: Number(i.TotalMRP),
        discountAmount: Number(i.DiscountAmount),
        cgstRate: Number(i.CGSTRate),
        cgstAmount: Number(i.CGSTAmount),
        sgstRate: Number(i.SGSTRate),
        sgstAmount: Number(i.SGSTAmount),
        igstRate: Number(i.IGSTRate),
        igstAmount: Number(i.IGSTAmount),
        taxAmount: Number(i.TaxAmount),
        totalAmount: Number(i.TotalAmount),
      })),
      fulfillments: fulRes.recordset.map((f) => ({
        fulfillmentId: String(f.FulfillmentID),
        status: f.FulfillmentStatus,
        createdAt: f.CreatedAt,
        updatedAt: f.UpdatedAt,
        warehouse: {
          warehouseId: String(f.WarehouseID),
          name: f.WarehouseName,
          code: f.WarehouseCode,
          city: f.WarehouseCity,
          state: f.WarehouseState,
        },
        seller: {
          sellerId: String(f.SellerID),
          name: f.SellerName,
          code: f.SellerCode,
        },
        shipment: f.ShipmentID
          ? {
              shipmentId: String(f.ShipmentID),
              carrier: f.Carrier,
              trackingNumber: f.TrackingNumber,
              status: f.ShipmentStatus,
              estimatedDeliveryDate: f.EstimatedDeliveryDate,
              shippedAt: f.ShippedAt,
            }
          : null,
      })),
      payments: payRes.recordset.map((p) => ({
        paymentId: String(p.PaymentID),
        amount: Number(p.Amount),
        status: p.PaymentStatus,
        gatewayReference: p.GatewayReference,
        paidAt: p.PaidAt,
        createdAt: p.CreatedAt,
        modeName: p.PaymentModeName,
        modeCode: p.PaymentModeCode,
        modeType: p.PaymentModeType,
      })),
      history: historyRes.recordset.map((h) => ({
        historyId: String(h.OrderStatusHistoryID),
        status: h.Status,
        changedAt: h.ChangedAt,
        changedBy: h.FirstName ? `${h.FirstName} ${h.LastName || ''}`.trim() : 'System',
      })),
    };
  }

  /**
   * Retrieves all warehouse fulfillments with package status and tracking.
   */
  async getFulfillmentsList(params: {
    status?: string;
    warehouseId?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ items: AdminFulfillmentListItem[]; total: number }> {
    const pool = await getPool();
    const req = pool.request();
    const whereClauses: string[] = ['1=1'];

    if (params.status && params.status.trim() !== '') {
      req.input('status', sql.VarChar(30), params.status.trim());
      whereClauses.push('f.Status = @status');
    }

    if (params.warehouseId) {
      req.input('warehouseId', sql.BigInt, BigInt(params.warehouseId));
      whereClauses.push('f.WarehouseID = @warehouseId');
    }

    if (params.search && params.search.trim() !== '') {
      req.input('search', sql.NVarChar(150), `%${params.search.trim()}%`);
      whereClauses.push(
        `(o.OrderNumber LIKE @search OR sh.TrackingNumber LIKE @search OR w.WarehouseName LIKE @search OR s.BusinessName LIKE @search)`
      );
    }

    const whereSql = whereClauses.join(' AND ');
    const offset = (params.page - 1) * params.limit;
    req.input('offset', sql.Int, offset);
    req.input('limit', sql.Int, params.limit);

    const query = `
      SELECT 
        f.FulfillmentID,
        f.OrderID,
        o.OrderNumber,
        o.Status AS OrderStatus,
        f.Status AS FulfillmentStatus,
        f.CreatedAt,
        f.UpdatedAt,
        s.SellerID,
        s.BusinessName AS SellerName,
        s.SellerCode,
        w.WarehouseID,
        w.WarehouseName,
        w.WarehouseCode,
        sh.Carrier,
        sh.TrackingNumber,
        sh.Status AS ShipmentStatus,
        (SELECT COUNT(1) FROM dbo.FulfillmentItems fi WHERE fi.FulfillmentID = f.FulfillmentID) AS ItemsCount,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.Fulfillments f
      JOIN dbo.Orders o ON f.OrderID = o.OrderID
      JOIN dbo.Sellers s ON f.SellerID = s.SellerID
      JOIN dbo.Warehouses w ON f.WarehouseID = w.WarehouseID
      LEFT JOIN dbo.Shipments sh ON f.FulfillmentID = sh.FulfillmentID
      WHERE ${whereSql}
      ORDER BY f.CreatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await req.query(query);
    const total = result.recordset.length > 0 ? Number(result.recordset[0].TotalCount) : 0;

    const items: AdminFulfillmentListItem[] = result.recordset.map((r) => ({
      fulfillmentId: String(r.FulfillmentID),
      orderId: String(r.OrderID),
      orderNumber: r.OrderNumber,
      orderStatus: r.OrderStatus,
      fulfillmentStatus: r.FulfillmentStatus,
      createdAt: r.CreatedAt,
      updatedAt: r.UpdatedAt,
      sellerId: String(r.SellerID),
      sellerName: r.SellerName,
      sellerCode: r.SellerCode,
      warehouseId: String(r.WarehouseID),
      warehouseName: r.WarehouseName,
      warehouseCode: r.WarehouseCode,
      carrier: r.Carrier,
      trackingNumber: r.TrackingNumber,
      shipmentStatus: r.ShipmentStatus,
      itemsCount: Number(r.ItemsCount || 0),
    }));

    return { items, total };
  }

  /**
   * Retrieves list of all payment transactions across orders.
   */
  async getPaymentsList(params: {
    status?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ items: AdminPaymentListItem[]; total: number }> {
    const pool = await getPool();
    const req = pool.request();
    const whereClauses: string[] = ['1=1'];

    if (params.status && params.status.trim() !== '') {
      req.input('status', sql.VarChar(30), params.status.trim());
      whereClauses.push('p.Status = @status');
    }

    if (params.search && params.search.trim() !== '') {
      req.input('search', sql.NVarChar(150), `%${params.search.trim()}%`);
      whereClauses.push(
        `(o.OrderNumber LIKE @search OR p.GatewayReference LIKE @search OR c.FirstName LIKE @search OR c.LastName LIKE @search OR c.Email LIKE @search)`
      );
    }

    const whereSql = whereClauses.join(' AND ');
    const offset = (params.page - 1) * params.limit;
    req.input('offset', sql.Int, offset);
    req.input('limit', sql.Int, params.limit);

    const query = `
      SELECT 
        p.PaymentID,
        p.OrderID,
        o.OrderNumber,
        p.Amount,
        p.Status AS PaymentStatus,
        p.GatewayReference,
        p.PaidAt,
        p.CreatedAt,
        CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
        c.Email AS CustomerEmail,
        pm.PaymentModeName,
        pm.PaymentModeCode,
        pm.PaymentModeType,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.Payments p
      JOIN dbo.Orders o ON p.OrderID = o.OrderID
      JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
      JOIN dbo.PaymentModes pm ON p.PaymentModeID = pm.PaymentModeID
      WHERE ${whereSql}
      ORDER BY p.CreatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await req.query(query);
    const total = result.recordset.length > 0 ? Number(result.recordset[0].TotalCount) : 0;

    const items: AdminPaymentListItem[] = result.recordset.map((r) => ({
      paymentId: String(r.PaymentID),
      orderId: String(r.OrderID),
      orderNumber: r.OrderNumber,
      amount: Number(r.Amount),
      paymentStatus: r.PaymentStatus,
      gatewayReference: r.GatewayReference,
      paidAt: r.PaidAt,
      createdAt: r.CreatedAt,
      customerName: r.CustomerName,
      customerEmail: r.CustomerEmail,
      paymentModeName: r.PaymentModeName,
      paymentModeCode: r.PaymentModeCode,
      paymentModeType: r.PaymentModeType,
    }));

    return { items, total };
  }

  /**
   * Retrieves cancelled and payment-expired orders with cancellation metadata.
   */
  async getCancelledOrdersList(params: {
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ items: AdminCancelledOrderListItem[]; total: number }> {
    const pool = await getPool();
    const req = pool.request();
    const whereClauses: string[] = [
      `o.Status IN ('CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED')`,
    ];

    if (params.search && params.search.trim() !== '') {
      req.input('search', sql.NVarChar(150), `%${params.search.trim()}%`);
      whereClauses.push(
        `(o.OrderNumber LIKE @search OR c.FirstName LIKE @search OR c.LastName LIKE @search OR c.Email LIKE @search)`
      );
    }

    const whereSql = whereClauses.join(' AND ');
    const offset = (params.page - 1) * params.limit;
    req.input('offset', sql.Int, offset);
    req.input('limit', sql.Int, params.limit);

    const query = `
      SELECT 
        o.OrderID,
        o.OrderNumber,
        o.Status,
        o.TotalAmount,
        o.CreatedAt,
        o.UpdatedAt AS CancelledAt,
        CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
        c.Email AS CustomerEmail,
        c.PhoneNumber AS CustomerPhone,
        p.Status AS PaymentStatus,
        (
          SELECT TOP 1 osh.Status
          FROM dbo.OrderStatusHistory osh
          WHERE osh.OrderID = o.OrderID AND osh.Status = 'CANCELLED'
          ORDER BY osh.ChangedAt DESC
        ) AS HistoryStatus,
        (
          SELECT TOP 1 CONCAT(u.FirstName, ' ', u.LastName)
          FROM dbo.OrderStatusHistory osh
          JOIN dbo.Users u ON osh.ChangedBy = u.UserID
          WHERE osh.OrderID = o.OrderID AND osh.Status = 'CANCELLED'
          ORDER BY osh.ChangedAt DESC
        ) AS AdminCancellerName,
        (
          SELECT TOP 1 it.Reason
          FROM dbo.InventoryTransactions it
          WHERE it.OrderID = o.OrderID AND it.TransactionType IN ('RESERVATION_RELEASED', 'RESERVATION_EXPIRED')
          ORDER BY it.CreatedAt DESC
        ) AS CancelReason,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.Orders o
      JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
      LEFT JOIN dbo.Payments p ON o.OrderID = p.OrderID
      WHERE ${whereSql}
      ORDER BY o.UpdatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await req.query(query);
    const total = result.recordset.length > 0 ? Number(result.recordset[0].TotalCount) : 0;

    const items: AdminCancelledOrderListItem[] = result.recordset.map((r) => {
      let cancelledBy = 'CUSTOMER / TIMEOUT';
      if (r.AdminCancellerName) {
        cancelledBy = `Admin: ${r.AdminCancellerName}`;
      } else if (r.Status === 'PAYMENT_EXPIRED') {
        cancelledBy = 'System: 15m Hold Expired';
      }

      return {
        orderId: String(r.OrderID),
        orderNumber: r.OrderNumber,
        status: r.Status,
        totalAmount: Number(r.TotalAmount),
        createdAt: r.CreatedAt,
        cancelledAt: r.CancelledAt,
        customerName: r.CustomerName,
        customerEmail: r.CustomerEmail,
        customerPhone: r.CustomerPhone,
        cancelledBy,
        reason: r.CancelReason || 'Order cancelled before fulfillment',
        refundStatus: r.PaymentStatus === 'SUCCESS' ? 'REFUND_PENDING' : r.PaymentStatus === 'REFUND_PENDING' ? 'REFUND_PENDING' : 'N/A',
      };
    });

    return { items, total };
  }

  /**
   * Executes atomic admin order cancellation with pre-dispatch validation, inventory restoration,
   * audit ledger recording, and pending refund flagging.
   */
  async cancelOrder(data: {
    orderId: bigint;
    reason: string;
    adminUserId: bigint;
  }): Promise<{ success: boolean; orderNumber: string; message: string }> {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Fetch order details with row-lock check
      const checkRes = await transaction
        .request()
        .input('orderId', sql.BigInt, data.orderId)
        .query<{ OrderNumber: string; Status: string }>(`
          SELECT OrderNumber, Status
          FROM dbo.Orders WITH (UPDLOCK, ROWLOCK)
          WHERE OrderID = @orderId;
        `);

      if (checkRes.recordset.length === 0) {
        throw new Error('Order not found');
      }

      const order = checkRes.recordset[0];
      if (order.Status === 'CANCELLED') {
        await transaction.rollback();
        return {
          success: true,
          orderNumber: order.OrderNumber,
          message: 'Order was already cancelled',
        };
      }

      if (order.Status === 'DELIVERED') {
        throw new Error('Cannot cancel order: Order is already marked as DELIVERED');
      }

      // 2. Dispatch Guard: Check if any fulfillment is PACKED, SHIPPED, or DELIVERED
      const fulCheck = await transaction
        .request()
        .input('orderId', sql.BigInt, data.orderId)
        .query<{ Status: string; FulfillmentID: bigint }>(`
          SELECT FulfillmentID, Status
          FROM dbo.Fulfillments
          WHERE OrderID = @orderId AND Status IN ('PACKED', 'SHIPPED', 'DELIVERED', 'OUT_FOR_DELIVERY');
        `);

      if (fulCheck.recordset.length > 0) {
        const blockingStatus = fulCheck.recordset[0].Status;
        throw new Error(`Cannot cancel order: Item(s) have already reached status '${blockingStatus}'`);
      }

      // 3. Atomically transition Orders status to CANCELLED
      await transaction
        .request()
        .input('orderId', sql.BigInt, data.orderId)
        .query(`
          UPDATE dbo.Orders
          SET Status = 'CANCELLED', UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId;
        `);

      // 4. Transition all active Fulfillments to CANCELLED
      await transaction
        .request()
        .input('orderId', sql.BigInt, data.orderId)
        .query(`
          UPDATE dbo.Fulfillments
          SET Status = 'CANCELLED', UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND Status != 'CANCELLED';
        `);

      // 5. Release any still-reserved quantities on dbo.Inventory
      await transaction
        .request()
        .input('orderId', sql.BigInt, data.orderId)
        .query(`
          UPDATE inv
          SET inv.ReservedQuantity = CASE WHEN inv.ReservedQuantity >= ir.Quantity THEN inv.ReservedQuantity - ir.Quantity ELSE 0 END,
              inv.UpdatedAt = SYSUTCDATETIME()
          FROM dbo.Inventory inv
          JOIN dbo.InventoryReservations ir ON inv.InventoryID = ir.InventoryID
          WHERE ir.OrderID = @orderId AND ir.Status = 'RESERVED';
        `);

      // 6. Audit Ledger: Write reservation release entries with running balance snapshot
      await transaction
        .request()
        .input('orderId', sql.BigInt, data.orderId)
        .input('reason', sql.NVarChar(500), `Admin Cancel: ${data.reason.trim()}`)
        .input('userId', sql.BigInt, data.adminUserId)
        .query(`
          INSERT INTO dbo.InventoryTransactions (
            InventoryID, OrderID, TransactionType, Quantity, BalanceBefore, BalanceAfter, Reason, CreatedAt, CreatedBy
          )
          SELECT 
            ir.InventoryID,
            @orderId,
            'RESERVATION_RELEASED',
            ir.Quantity,
            inv.PhysicalQuantity,
            inv.PhysicalQuantity,
            @reason,
            SYSUTCDATETIME(),
            @userId
          FROM dbo.InventoryReservations ir
          JOIN dbo.Inventory inv ON ir.InventoryID = inv.InventoryID
          WHERE ir.OrderID = @orderId AND ir.Status = 'RESERVED';
        `);

      // 7. Transition reservations to CANCELLED
      await transaction
        .request()
        .input('orderId', sql.BigInt, data.orderId)
        .query(`
          UPDATE dbo.InventoryReservations
          SET Status = 'CANCELLED', UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND Status = 'RESERVED';
        `);

      // 8. Write status milestone to dbo.OrderStatusHistory
      await transaction
        .request()
        .input('orderId', sql.BigInt, data.orderId)
        .input('userId', sql.BigInt, data.adminUserId)
        .query(`
          INSERT INTO dbo.OrderStatusHistory (
            OrderID, Status, ChangedAt, ChangedBy
          )
          VALUES (
            @orderId, 'CANCELLED', SYSUTCDATETIME(), @userId
          );
        `);

      // 9. Prepaid protection: Flag payment for refund so customer funds are not orphaned
      await transaction
        .request()
        .input('orderId', sql.BigInt, data.orderId)
        .query(`
          UPDATE dbo.Payments
          SET Status = 'REFUND_PENDING', UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND Status = 'SUCCESS';
        `);

      await transaction.commit();

      return {
        success: true,
        orderNumber: order.OrderNumber,
        message: 'Order successfully cancelled and inventory released.',
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async getReturnsList(params: {
    search?: string;
    status?: string;
    page: number;
    limit: number;
  }) {
    const pool = await getPool();
    const req = pool.request();
    const offset = (params.page - 1) * params.limit;
    req.input('offset', sql.Int, offset);
    req.input('limit', sql.Int, params.limit);

    let whereSql = '1=1';

    if (params.search && params.search.trim()) {
      req.input('search', sql.NVarChar, `%${params.search.trim()}%`);
      whereSql += ` AND (
        rr.RequestNumber LIKE @search OR
        o.OrderNumber LIKE @search OR
        pm.ProductName LIKE @search OR
        pv.VariantSKU LIKE @search OR
        c.FirstName LIKE @search OR
        c.LastName LIKE @search OR
        c.Email LIKE @search OR
        c.PhoneNumber LIKE @search
      )`;
    }

    if (params.status && params.status !== 'ALL') {
      const s = params.status.toUpperCase();
      if ([
        'REQUESTED',
        'APPROVED',
        'RECEIVED',
        'QC_PASSED',
        'QC_FAILED',
        'REFUNDED',
        'REPLACED',
        'REJECTED',
        'CANCELLED',
        'IN_PROGRESS',
        'RESOLVED',
      ].includes(s)) {
        req.input('status', sql.VarChar(30), s);
        whereSql += ` AND rr.Status = @status`;
      }
    }

    const query = `
      SELECT 
        rr.ReturnRequestID,
        rr.RequestNumber,
        rr.OrderID,
        rr.OrderItemID,
        rr.CustomerID,
        rr.SellerProductID,
        rr.RequestType,
        rr.ReasonCategory,
        rr.ReasonDescription,
        rr.Quantity,
        rr.ResolutionType,
        rr.RefundMethod,
        rr.RefundDetailsJson,
        rr.Status,
        rr.DestinationType,
        rr.DestinationID,
        rr.QCStatus,
        rr.QCNotes,
        rr.QCGrade,
        rr.RestockedInventory,
        rr.RefundTransactionID,
        rr.ReplacementOrderID,
        rr.AdminComments,
        rr.PickupAddressJson,
        rr.TrackingNumber,
        rr.CreatedAt,
        rr.UpdatedAt,
        o.OrderNumber,
        o.Status AS OrderStatus,
        o.TotalAmount AS OrderTotal,
        oi.UnitPrice,
        oi.TotalAmount AS ItemTotal,
        CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
        c.Email AS CustomerEmail,
        c.PhoneNumber AS CustomerPhone,
        pm.ProductName,
        pv.VariantSKU,
        rp.PolicyCode,
        rp.PolicyName,
        rp.ReturnWindowDays,
        rp.ReplacementWindowDays,
        rp.RequiresTechnicianCheck,
        (
          SELECT rra.AssetURL
          FROM dbo.ReturnRequestAssets rra
          WHERE rra.ReturnRequestID = rr.ReturnRequestID
          FOR JSON PATH
        ) AS AssetsJson,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.ReturnRequests rr
      JOIN dbo.Orders o ON rr.OrderID = o.OrderID
      JOIN dbo.Customers c ON rr.CustomerID = c.CustomerID
      JOIN dbo.OrderItems oi ON rr.OrderItemID = oi.OrderItemID
      LEFT JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
      LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
      LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
      OUTER APPLY (
        SELECT TOP 1 c.DefaultReturnPolicyID
        FROM dbo.ProductCategories pc
        JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID
        WHERE pc.ProductID = pm.ProductID
        ORDER BY pc.ProductCategoryID ASC
      ) cat
      LEFT JOIN dbo.ReturnReplacementPolicies rp ON rp.PolicyID = COALESCE(pm.ReturnPolicyID, cat.DefaultReturnPolicyID, 1)
      WHERE ${whereSql}
      ORDER BY rr.ReturnRequestID DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const summaryQuery = `
      SELECT 
        COUNT(1) AS TotalCount,
        SUM(CASE WHEN rr.Status = 'REQUESTED' THEN 1 ELSE 0 END) AS RequestedCount,
        SUM(CASE WHEN rr.Status = 'APPROVED' THEN 1 ELSE 0 END) AS ApprovedCount,
        SUM(CASE WHEN rr.Status = 'RECEIVED' THEN 1 ELSE 0 END) AS ReceivedCount,
        SUM(CASE WHEN rr.Status = 'QC_PASSED' THEN 1 ELSE 0 END) AS QcPassedCount,
        SUM(CASE WHEN rr.Status = 'QC_FAILED' THEN 1 ELSE 0 END) AS QcFailedCount,
        SUM(CASE WHEN rr.Status IN ('REFUNDED', 'RESOLVED') THEN 1 ELSE 0 END) AS RefundedCount,
        SUM(CASE WHEN rr.Status = 'REPLACED' THEN 1 ELSE 0 END) AS ReplacedCount,
        SUM(CASE WHEN rr.Status = 'REJECTED' THEN 1 ELSE 0 END) AS RejectedCount,
        SUM(CASE WHEN rr.Status = 'CANCELLED' THEN 1 ELSE 0 END) AS CancelledCount,
        SUM(CASE WHEN rr.Status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS InProgressCount
      FROM dbo.ReturnRequests rr;
    `;

    const [result, summaryRes] = await Promise.all([
      req.query(query),
      pool.request().query(summaryQuery),
    ]);

    const total = result.recordset.length > 0 ? Number(result.recordset[0].TotalCount) : 0;
    const summaryRow = summaryRes.recordset[0] || {};

    const items = result.recordset.map((r: any) => ({
      returnRequestId: String(r.ReturnRequestID),
      requestNumber: r.RequestNumber,
      orderId: String(r.OrderID),
      orderItemId: String(r.OrderItemID),
      orderNumber: r.OrderNumber,
      orderStatus: r.OrderStatus,
      orderTotal: Number(r.OrderTotal || 0),
      customerName: r.CustomerName,
      customerEmail: r.CustomerEmail,
      customerPhone: r.CustomerPhone,
      productName: r.ProductName,
      variantSku: r.VariantSKU || 'N/A',
      unitPrice: Number(r.UnitPrice || 0),
      itemTotal: Number(r.ItemTotal || 0),
      quantity: Number(r.Quantity || 1),
      requestType: r.RequestType,
      reasonCategory: r.ReasonCategory,
      reasonDescription: r.ReasonDescription,
      resolutionType: r.ResolutionType,
      refundMethod: r.RefundMethod,
      refundDetails: r.RefundDetailsJson ? JSON.parse(r.RefundDetailsJson) : null,
      status: r.Status,
      destinationType: r.DestinationType || null,
      destinationId: r.DestinationID ? String(r.DestinationID) : null,
      qcStatus: r.QCStatus || null,
      qcNotes: r.QCNotes || null,
      qcGrade: r.QCGrade || null,
      restockedInventory: Boolean(r.RestockedInventory),
      refundTransactionId: r.RefundTransactionID || null,
      replacementOrderId: r.ReplacementOrderID ? String(r.ReplacementOrderID) : null,
      adminComments: r.AdminComments,
      pickupAddress: r.PickupAddressJson ? JSON.parse(r.PickupAddressJson) : null,
      trackingNumber: r.TrackingNumber,
      policy: {
        policyCode: r.PolicyCode,
        policyName: r.PolicyName,
        returnWindowDays: Number(r.ReturnWindowDays || 0),
        replacementWindowDays: Number(r.ReplacementWindowDays || 0),
        requiresTechnicianCheck: Boolean(r.RequiresTechnicianCheck),
      },
      assets: r.AssetsJson ? JSON.parse(r.AssetsJson).map((a: any) => a.AssetURL) : [],
      createdAt: r.CreatedAt,
      updatedAt: r.UpdatedAt,
    }));

    return {
      items,
      total,
      summary: {
        total: Number(summaryRow.TotalCount || 0),
        requested: Number(summaryRow.RequestedCount || 0),
        approved: Number(summaryRow.ApprovedCount || 0),
        received: Number(summaryRow.ReceivedCount || 0),
        qcPassed: Number(summaryRow.QcPassedCount || 0),
        qcFailed: Number(summaryRow.QcFailedCount || 0),
        refunded: Number(summaryRow.RefundedCount || 0),
        replaced: Number(summaryRow.ReplacedCount || 0),
        rejected: Number(summaryRow.RejectedCount || 0),
        cancelled: Number(summaryRow.CancelledCount || 0),
        inProgress: Number(summaryRow.InProgressCount || 0),
      },
    };
  }

  async updateReturnStatus(data: {
    returnRequestId: bigint;
    status: string;
    adminComments?: string;
    trackingNumber?: string;
    qcStatus?: 'PENDING' | 'PASSED' | 'FAILED';
    qcNotes?: string;
    qcGrade?: string;
    refundTransactionId?: string;
    replacementOrderId?: bigint;
    restockInventory?: boolean;
    adminUserId: bigint;
  }) {
    const pool = await getPool();
    const res = await pool
      .request()
      .input('returnRequestId', sql.BigInt, data.returnRequestId)
      .input('status', sql.VarChar(30), data.status)
      .input('adminComments', sql.NVarChar(1000), data.adminComments || null)
      .input('trackingNumber', sql.NVarChar(100), data.trackingNumber || null)
      .input('qcStatus', sql.VarChar(30), data.qcStatus || null)
      .input('qcNotes', sql.NVarChar(1000), data.qcNotes || null)
      .input('qcGrade', sql.VarChar(30), data.qcGrade || null)
      .input('refundTxId', sql.NVarChar(100), data.refundTransactionId || null)
      .input('replacementOrdId', sql.BigInt, data.replacementOrderId || null)
      .input('restockInv', sql.Bit, data.restockInventory ?? null)
      .query(`
        UPDATE dbo.ReturnRequests
        SET 
          Status = @status,
          AdminComments = COALESCE(@adminComments, AdminComments),
          TrackingNumber = COALESCE(@trackingNumber, TrackingNumber),
          QCStatus = COALESCE(@qcStatus, QCStatus),
          QCNotes = COALESCE(@qcNotes, QCNotes),
          QCGrade = COALESCE(@qcGrade, QCGrade),
          RefundTransactionID = COALESCE(@refundTxId, RefundTransactionID),
          ReplacementOrderID = COALESCE(@replacementOrdId, ReplacementOrderID),
          RestockedInventory = COALESCE(@restockInv, RestockedInventory),
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.ReturnRequestID, INSERTED.RequestNumber, INSERTED.Status, INSERTED.UpdatedAt
        WHERE ReturnRequestID = @returnRequestId;
      `);

    return res.recordset[0] || null;
  }
}

export const adminOrdersRepository = new AdminOrdersRepository();


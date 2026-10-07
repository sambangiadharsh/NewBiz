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
   * Retrieves order volume and revenue KPIs for this seller.
   */
  async getOrdersSummary(sellerId: bigint | number) {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('sellerId', sql.BigInt, sellerId)
      .query(`
        SELECT 
          COUNT(DISTINCT so.SellerOrderID) AS TotalOrders,
          ISNULL(SUM(CASE WHEN so.Status IN ('PENDING', 'CONFIRMED', 'CREATED') THEN 1 ELSE 0 END), 0) AS PendingOrders,
          ISNULL(SUM(CASE WHEN so.Status IN ('PROCESSING', 'PACKING', 'READY_TO_SHIP') THEN 1 ELSE 0 END), 0) AS ProcessingOrders,
          ISNULL(SUM(CASE WHEN so.Status IN ('SHIPPED', 'IN_TRANSIT') THEN 1 ELSE 0 END), 0) AS ShippedOrders,
          ISNULL(SUM(CASE WHEN so.Status = 'DELIVERED' THEN 1 ELSE 0 END), 0) AS DeliveredOrders,
          ISNULL(SUM(CASE WHEN so.Status IN ('CANCELLED', 'REFUNDED') THEN 1 ELSE 0 END), 0) AS CancelledOrders,
          ISNULL(SUM(oi.TotalAmount), 0) AS TotalRevenue
        FROM dbo.SellerOrders so
        JOIN dbo.Orders o ON so.OrderID = o.OrderID
        LEFT JOIN dbo.OrderItems oi ON o.OrderID = oi.OrderID
        JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID AND sp.SellerID = @sellerId
        WHERE so.SellerID = @sellerId;
      `);

    return result.recordset[0];
  }

  /**
   * Retrieves paginated list of orders for the seller with customer info, item count, and fulfillment status.
   */
  async getOrdersList(sellerId: bigint | number, filters: OrderListFilters) {
    const pool = await getPool();
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        so.SellerOrderID,
        so.OrderID,
        so.Status AS SellerOrderStatus,
        so.CreatedAt AS OrderPlacedAt,
        so.UpdatedAt AS OrderUpdatedAt,
        o.OrderNumber,
        o.Status AS MasterOrderStatus,
        c.CustomerID,
        c.FirstName AS CustomerFirstName,
        c.LastName AS CustomerLastName,
        c.Email AS CustomerEmail,
        c.PhoneNumber AS CustomerPhone,
        sa.RecipientName AS ShippingRecipientName,
        sa.City AS ShippingCity,
        sa.State AS ShippingState,
        sa.PostalCode AS ShippingPostalCode,
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
      FROM dbo.SellerOrders so
      JOIN dbo.Orders o ON so.OrderID = o.OrderID
      JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
      LEFT JOIN dbo.CustomerAddresses sa ON o.ShippingAddressID = sa.CustomerAddressID
      JOIN dbo.OrderItems oi ON o.OrderID = oi.OrderID
      JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID AND sp.SellerID = @sellerId
      LEFT JOIN dbo.Fulfillments f ON o.OrderID = f.OrderID AND f.SellerID = @sellerId
      LEFT JOIN dbo.Warehouses w ON f.WarehouseID = w.WarehouseID
      LEFT JOIN dbo.Shipments s ON f.FulfillmentID = s.FulfillmentID
      WHERE so.SellerID = @sellerId
    `;

    const request = pool.request().input('sellerId', sql.BigInt, sellerId);

    if (filters.status && filters.status !== 'ALL') {
      request.input('status', sql.VarChar, filters.status);
      query += ` AND so.Status = @status`;
    }

    if (filters.search && filters.search.trim()) {
      request.input('search', sql.NVarChar, `%${filters.search.trim()}%`);
      query += ` AND (
        o.OrderNumber LIKE @search OR
        c.FirstName LIKE @search OR
        c.LastName LIKE @search OR
        c.Email LIKE @search OR
        s.TrackingNumber LIKE @search OR
        sa.City LIKE @search
      )`;
    }

    query += `
      GROUP BY 
        so.SellerOrderID, so.OrderID, so.Status, so.CreatedAt, so.UpdatedAt,
        o.OrderNumber, o.Status, c.CustomerID, c.FirstName, c.LastName, c.Email, c.PhoneNumber,
        sa.RecipientName, sa.City, sa.State, sa.PostalCode
      ORDER BY so.SellerOrderID DESC
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

    // 1. Order Header
    const headerResult = await pool
      .request()
      .input('sellerOrderId', sql.BigInt, sellerOrderId)
      .input('sellerId', sql.BigInt, sellerId)
      .query(`
        SELECT 
          so.SellerOrderID,
          so.OrderID,
          so.SellerID,
          so.Status AS SellerOrderStatus,
          so.CreatedAt AS OrderPlacedAt,
          so.UpdatedAt AS OrderUpdatedAt,
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
          sa.RecipientName AS ShippingRecipientName,
          sa.AddressLine1 AS ShippingAddressLine1,
          sa.AddressLine2 AS ShippingAddressLine2,
          sa.City AS ShippingCity,
          sa.State AS ShippingState,
          sa.PostalCode AS ShippingPostalCode,
          sa.Country AS ShippingCountry,
          sa.PhoneNumber AS ShippingPhone,
          f.FulfillmentID,
          f.WarehouseID,
          w.WarehouseName,
          w.WarehouseCode,
          s.ShipmentID,
          s.Carrier,
          s.TrackingNumber,
          s.Status AS ShipmentStatus,
          s.PackageWeight,
          s.PackageLength,
          s.PackageWidth,
          s.PackageHeight,
          s.EstimatedDeliveryDate,
          s.ShippedAt,
          s.DeliveredAt,
          inv.InvoiceID,
          inv.InvoiceNumber,
          inv.InvoiceDate,
          inv.TotalAmount AS InvoiceTotalAmount
        FROM dbo.SellerOrders so
        JOIN dbo.Orders o ON so.OrderID = o.OrderID
        JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
        LEFT JOIN dbo.CustomerAddresses sa ON o.ShippingAddressID = sa.CustomerAddressID
        LEFT JOIN dbo.Fulfillments f ON o.OrderID = f.OrderID AND f.SellerID = @sellerId
        LEFT JOIN dbo.Warehouses w ON f.WarehouseID = w.WarehouseID
        LEFT JOIN dbo.Shipments s ON f.FulfillmentID = s.FulfillmentID
        LEFT JOIN dbo.Invoices inv ON f.FulfillmentID = inv.FulfillmentID
        WHERE so.SellerOrderID = @sellerOrderId AND so.SellerID = @sellerId;
      `);

    if (headerResult.recordset.length === 0) {
      return null;
    }

    const header = headerResult.recordset[0];

    // 2. Order Line Items for this seller
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
          oi.CGSTAmount,
          oi.SGSTAmount,
          oi.IGSTAmount,
          oi.TaxAmount,
          oi.TotalAmount,
          sp.SellerSKU,
          pm.ProductID,
          pm.ProductName,
          pm.ProductTitle,
          b.BrandName
        FROM dbo.OrderItems oi
        JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
        JOIN dbo.ProductMaster pm ON sp.ProductID = pm.ProductID
        LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
        WHERE oi.OrderID = @orderId AND sp.SellerID = @sellerId;
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
        UPDATE dbo.SellerOrders
        SET Status = @newStatus,
            UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.SellerOrderID, INSERTED.Status, INSERTED.UpdatedAt
        WHERE SellerOrderID = @sellerOrderId AND SellerID = @sellerId;
      `);

    if (result.recordset.length === 0) {
      throw new Error('Seller order not found or access denied');
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
          SELECT so.OrderID, f.FulfillmentID, f.WarehouseID
          FROM dbo.SellerOrders so
          LEFT JOIN dbo.Fulfillments f ON so.OrderID = f.OrderID AND f.SellerID = @sellerId
          WHERE so.SellerOrderID = @sellerOrderId AND so.SellerID = @sellerId
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

      // 3. Update SellerOrder status to SHIPPED
      await transaction
        .request()
        .input('sellerOrderId', sql.BigInt, sellerOrderId)
        .input('sellerId', sql.BigInt, sellerId)
        .query(`
          UPDATE dbo.SellerOrders
          SET Status = 'SHIPPED',
              UpdatedAt = SYSUTCDATETIME()
          WHERE SellerOrderID = @sellerOrderId AND SellerID = @sellerId
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

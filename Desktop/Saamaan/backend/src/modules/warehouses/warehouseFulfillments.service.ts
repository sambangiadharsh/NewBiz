import { getPool, sql } from '../../database/db.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { invoicePdfService } from '../orders/invoicePdf.service.js';

export interface FulfillmentItemDto {
  orderItemId: string;
  sellerProductId: string;
  productName: string;
  productCode?: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface WarehouseFulfillmentDto {
  fulfillmentId: string;
  orderId: string;
  orderNumber: string;
  sellerId: string;
  warehouseId: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  shippingAddress: {
    recipientName: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  invoice?: {
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: number;
    status: string;
  };
  shipment?: {
    carrier?: string;
    trackingNumber?: string;
    shippedAt?: string;
  };
  items: FulfillmentItemDto[];
}

export class WarehouseFulfillmentsService {
  private columnEnsured = false;

  private async ensureColumn(pool: any) {
    if (this.columnEnsured) return;
    try {
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'FulfillmentID'
        )
        BEGIN
          ALTER TABLE dbo.OrderItems ADD FulfillmentID BIGINT NULL;
        END
      `);
      this.columnEnsured = true;
    } catch {
      // Ignore if already being altered concurrently
    }
  }

  /**
   * List all fulfillments assigned to a specific warehouse facility.
   */
  async listFulfillments(
    warehouseId: bigint,
    statusFilter?: string
  ): Promise<WarehouseFulfillmentDto[]> {
    const pool = await getPool();
    await this.ensureColumn(pool);

    const query = pool
      .request()
      .input('whId', sql.BigInt, warehouseId)
      .input('status', sql.VarChar(50), statusFilter || null);

    const result = await query.query(`
      SELECT 
        f.FulfillmentID,
        f.OrderID,
        f.SellerID,
        f.WarehouseID,
        f.Status,
        f.CreatedAt,
        f.UpdatedAt,
        o.OrderNumber,
        o.TotalAmount AS OrderTotalAmount,
        o.Status AS OrderStatus,
        c.FirstName AS CustomerFirstName,
        c.LastName AS CustomerLastName,
        c.Email AS CustomerEmail,
        c.PhoneNumber AS CustomerPhone,
        COALESCE(o.ShippingRecipientName, c.FirstName + ' ' + ISNULL(c.LastName, '')) AS ShippingRecipientName,
        COALESCE(o.ShippingPhoneNumber, c.PhoneNumber) AS ShippingPhone,
        o.ShippingAddressLine1 AS ShippingAddress1,
        o.ShippingAddressLine2 AS ShippingAddress2,
        o.ShippingCity AS ShippingCity,
        o.ShippingState AS ShippingState,
        o.ShippingPostalCode AS ShippingPostalCode,
        inv.InvoiceID,
        inv.InvoiceNumber,
        inv.TotalAmount AS InvoiceTotalAmount,
        inv.Status AS InvoiceStatus,
        sh.Carrier,
        sh.TrackingNumber,
        sh.ShippedAt,
        (
          SELECT 
            oi.OrderItemID,
            COALESCE(fi.Quantity, oi.Quantity) AS Quantity,
            oi.UnitPrice,
            (oi.UnitPrice * COALESCE(fi.Quantity, oi.Quantity)) AS TotalAmount,
            sp.SellerProductID,
            sp.SellerSKU AS SKU,
            pm.ProductName,
            pm.ParentSKU AS ProductCode,
            COALESCE(pv.VariantModelCode, pv.VariantSKU) AS VariantName,
            pv.VariantSKU,
            wp.WarehouseSKU
          FROM dbo.OrderItems oi
          JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
          LEFT JOIN dbo.FulfillmentItems fi ON fi.FulfillmentID = f.FulfillmentID AND fi.OrderItemID = oi.OrderItemID
          LEFT JOIN dbo.WarehouseProducts wp ON fi.WarehouseProductID = wp.WarehouseProductID
          LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
          LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
          WHERE fi.FulfillmentID = f.FulfillmentID 
             OR (fi.FulfillmentID IS NULL AND (oi.FulfillmentID = f.FulfillmentID OR oi.OrderID = f.OrderID))
          FOR JSON PATH
        ) AS ItemsJson
      FROM dbo.Fulfillments f
      JOIN dbo.Orders o ON f.OrderID = o.OrderID
      JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
      LEFT JOIN dbo.Invoices inv ON f.FulfillmentID = inv.FulfillmentID
      LEFT JOIN dbo.Shipments sh ON f.FulfillmentID = sh.FulfillmentID
      WHERE f.WarehouseID = @whId
        AND (@status IS NULL OR @status = '' OR f.Status = @status)
      ORDER BY f.CreatedAt DESC;
    `);

    return result.recordset.map((row) => this.mapFulfillmentRow(row));
  }

  /**
   * Get single fulfillment by ID
   */
  async getFulfillmentById(
    warehouseId: bigint,
    fulfillmentId: bigint
  ): Promise<WarehouseFulfillmentDto> {
    const pool = await getPool();
    await this.ensureColumn(pool);

    const result = await pool
      .request()
      .input('whId', sql.BigInt, warehouseId)
      .input('fId', sql.BigInt, fulfillmentId)
      .query(`
        SELECT 
          f.FulfillmentID,
          f.OrderID,
          f.SellerID,
          f.WarehouseID,
          f.Status,
          f.CreatedAt,
          f.UpdatedAt,
          o.OrderNumber,
          o.TotalAmount AS OrderTotalAmount,
          o.Status AS OrderStatus,
          c.FirstName AS CustomerFirstName,
          c.LastName AS CustomerLastName,
          c.Email AS CustomerEmail,
          c.PhoneNumber AS CustomerPhone,
          COALESCE(o.ShippingRecipientName, c.FirstName + ' ' + ISNULL(c.LastName, '')) AS ShippingRecipientName,
          COALESCE(o.ShippingPhoneNumber, c.PhoneNumber) AS ShippingPhone,
          o.ShippingAddressLine1 AS ShippingAddress1,
          o.ShippingAddressLine2 AS ShippingAddress2,
          o.ShippingCity AS ShippingCity,
          o.ShippingState AS ShippingState,
          o.ShippingPostalCode AS ShippingPostalCode,
          inv.InvoiceID,
          inv.InvoiceNumber,
          inv.TotalAmount AS InvoiceTotalAmount,
          inv.Status AS InvoiceStatus,
          sh.Carrier,
          sh.TrackingNumber,
          sh.ShippedAt,
          (
            SELECT 
              oi.OrderItemID,
              COALESCE(fi.Quantity, oi.Quantity) AS Quantity,
              oi.UnitPrice,
              (oi.UnitPrice * COALESCE(fi.Quantity, oi.Quantity)) AS TotalAmount,
              sp.SellerProductID,
              sp.SellerSKU AS SKU,
              pm.ProductName,
              pm.ParentSKU AS ProductCode,
              COALESCE(pv.VariantModelCode, pv.VariantSKU) AS VariantName,
              pv.VariantSKU,
              wp.WarehouseSKU
            FROM dbo.OrderItems oi
            JOIN dbo.SellerProducts sp ON oi.SellerProductID = sp.SellerProductID
            LEFT JOIN dbo.FulfillmentItems fi ON fi.FulfillmentID = f.FulfillmentID AND fi.OrderItemID = oi.OrderItemID
            LEFT JOIN dbo.WarehouseProducts wp ON fi.WarehouseProductID = wp.WarehouseProductID
            LEFT JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
            LEFT JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
            WHERE fi.FulfillmentID = f.FulfillmentID 
               OR (fi.FulfillmentID IS NULL AND (oi.FulfillmentID = f.FulfillmentID OR oi.OrderID = f.OrderID))
            FOR JSON PATH
          ) AS ItemsJson
        FROM dbo.Fulfillments f
        JOIN dbo.Orders o ON f.OrderID = o.OrderID
        JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
        LEFT JOIN dbo.Invoices inv ON f.FulfillmentID = inv.FulfillmentID
        LEFT JOIN dbo.Shipments sh ON f.FulfillmentID = sh.FulfillmentID
        WHERE f.WarehouseID = @whId AND f.FulfillmentID = @fId;
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundError('Fulfillment record not found for this warehouse');
    }

    return this.mapFulfillmentRow(result.recordset[0]);
  }

  /**
   * Update fulfillment status through the 5-stage lifecycle:
   * PENDING_PICKUP -> PACKING -> PACKED -> DISPATCHED -> DELIVERED
   */
  async updateStatus(
    warehouseId: bigint,
    fulfillmentId: bigint,
    newStatus: string,
    options?: { carrier?: string; trackingNumber?: string }
  ) {
    const validStatuses = ['PENDING_PICKUP', 'PACKING', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];
    const targetStatus = newStatus.toUpperCase();

    if (!validStatuses.includes(targetStatus)) {
      throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const pool = await getPool();

    // Verify fulfillment exists for this warehouse
    const fulRes = await pool
      .request()
      .input('whId', sql.BigInt, warehouseId)
      .input('fId', sql.BigInt, fulfillmentId)
      .query<{
        FulfillmentID: bigint;
        OrderID: bigint;
        SellerID: bigint;
        Status: string;
      }>(`
        SELECT FulfillmentID, OrderID, SellerID, Status
        FROM dbo.Fulfillments
        WHERE WarehouseID = @whId AND FulfillmentID = @fId;
      `);

    if (fulRes.recordset.length === 0) {
      throw new NotFoundError('Fulfillment not found for this warehouse');
    }

    const ful = fulRes.recordset[0];
    const currentStatus = ful.Status;

    if (currentStatus === targetStatus) {
      return { success: true, message: `Status is already ${targetStatus}` };
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Update Fulfillment status
      await transaction
        .request()
        .input('fId', sql.BigInt, fulfillmentId)
        .input('status', sql.VarChar(50), targetStatus)
        .query(`
          UPDATE dbo.Fulfillments
          SET Status = @status, UpdatedAt = SYSUTCDATETIME()
          WHERE FulfillmentID = @fId;
        `);

      // 2. If transitioning to DISPATCHED:
      // Permanently deduct inventory (Physical - qty, Reserved - qty)
      if (targetStatus === 'DISPATCHED' && currentStatus !== 'DISPATCHED' && currentStatus !== 'DELIVERED') {
        // Query items for this fulfillment
        const itemsRes = await transaction
          .request()
          .input('fId', sql.BigInt, fulfillmentId)
          .input('orderId', sql.BigInt, ful.OrderID)
          .query<{
            SellerProductID: bigint;
            Quantity: number;
          }>(`
            SELECT 
              oi.SellerProductID, 
              COALESCE(fi.Quantity, oi.Quantity) AS Quantity
            FROM dbo.OrderItems oi
            LEFT JOIN dbo.FulfillmentItems fi ON fi.FulfillmentID = @fId AND fi.OrderItemID = oi.OrderItemID
            WHERE fi.FulfillmentID = @fId 
               OR (fi.FulfillmentID IS NULL AND (oi.FulfillmentID = @fId OR oi.OrderID = @orderId));
          `);

        for (const itm of itemsRes.recordset) {
          await transaction
            .request()
            .input('whId', sql.BigInt, warehouseId)
            .input('spId', sql.BigInt, itm.SellerProductID)
            .input('qty', sql.Int, itm.Quantity)
            .input('orderId', sql.BigInt, ful.OrderID)
            .input('fId', sql.BigInt, fulfillmentId)
            .query(`
              UPDATE inv
              SET 
                inv.PhysicalQuantity = CASE WHEN inv.PhysicalQuantity >= @qty THEN inv.PhysicalQuantity - @qty ELSE 0 END,
                inv.ReservedQuantity = CASE WHEN inv.ReservedQuantity >= @qty THEN inv.ReservedQuantity - @qty ELSE 0 END,
                inv.UpdatedAt = SYSUTCDATETIME()
              FROM dbo.Inventory inv
              JOIN dbo.WarehouseProducts wp ON inv.WarehouseProductID = wp.WarehouseProductID
              WHERE wp.WarehouseID = @whId AND wp.SellerProductID = @spId;

              -- Transition reservation status to FULFILLED
              UPDATE ir
              SET ir.Status = 'FULFILLED', ir.UpdatedAt = SYSUTCDATETIME()
              FROM dbo.InventoryReservations ir
              JOIN dbo.Inventory inv ON ir.InventoryID = inv.InventoryID
              JOIN dbo.WarehouseProducts wp ON inv.WarehouseProductID = wp.WarehouseProductID
              WHERE ir.OrderID = @orderId AND wp.WarehouseID = @whId AND wp.SellerProductID = @spId AND ir.Status = 'RESERVED';

              -- Audit Ledger: Outbound dispatch
              INSERT INTO dbo.InventoryTransactions (
                InventoryID, OrderID, TransactionType, Quantity, Reason, CreatedAt
              )
              SELECT inv.InventoryID, @orderId, 'OUTBOUND_DISPATCH', -@qty, 'Dispatched fulfillment #' + CAST(@fId AS VARCHAR(50)), SYSUTCDATETIME()
              FROM dbo.Inventory inv
              JOIN dbo.WarehouseProducts wp ON inv.WarehouseProductID = wp.WarehouseProductID
              WHERE wp.WarehouseID = @whId AND wp.SellerProductID = @spId;
            `);
        }

        // Create or update Shipment record
        const carrier = options?.carrier?.trim() || 'Internal Logistics';
        const tracking = options?.trackingNumber?.trim() || `TRK-${Date.now().toString().slice(-8)}`;

        await transaction
          .request()
          .input('fId', sql.BigInt, fulfillmentId)
          .input('carrier', sql.NVarChar(100), carrier)
          .input('trackNo', sql.NVarChar(100), tracking)
          .query(`
            IF EXISTS (SELECT 1 FROM dbo.Shipments WHERE FulfillmentID = @fId)
            BEGIN
              UPDATE dbo.Shipments
              SET Carrier = @carrier, TrackingNumber = @trackNo, Status = 'SHIPPED',
                  ShippedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
              WHERE FulfillmentID = @fId;
            END
            ELSE
            BEGIN
              INSERT INTO dbo.Shipments (
                FulfillmentID, Carrier, TrackingNumber, Status,
                PackageWeight, PackageLength, PackageWidth, PackageHeight,
                ShippedAt, CreatedAt, UpdatedAt
              )
              VALUES (
                @fId, @carrier, @trackNo, 'SHIPPED',
                1.0, 10.0, 10.0, 10.0,
                SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME()
              );
            END
          `);

        // Check if all fulfillments of this order are now DISPATCHED
        const remainingFulRes = await transaction
          .request()
          .input('orderId', sql.BigInt, ful.OrderID)
          .query<{ pendingCount: number }>(`
            SELECT COUNT(1) AS pendingCount
            FROM dbo.Fulfillments
            WHERE OrderID = @orderId AND Status NOT IN ('DISPATCHED', 'DELIVERED');
          `);

        if (remainingFulRes.recordset[0]?.pendingCount === 0) {
          await transaction
            .request()
            .input('orderId', sql.BigInt, ful.OrderID)
            .query(`
              UPDATE dbo.Orders SET Status = 'SHIPPED', UpdatedAt = SYSUTCDATETIME() WHERE OrderID = @orderId;
            `);
        }
      }

      // 3. If transitioning to DELIVERED:
      if (targetStatus === 'DELIVERED') {
        await transaction
          .request()
          .input('fId', sql.BigInt, fulfillmentId)
          .query(`
            UPDATE dbo.Shipments
            SET Status = 'DELIVERED', DeliveredAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
            WHERE FulfillmentID = @fId;
          `);

        const remainingDeliveryRes = await transaction
          .request()
          .input('orderId', sql.BigInt, ful.OrderID)
          .query<{ pendingCount: number }>(`
            SELECT COUNT(1) AS pendingCount
            FROM dbo.Fulfillments
            WHERE OrderID = @orderId AND Status != 'DELIVERED';
          `);

        if (remainingDeliveryRes.recordset[0]?.pendingCount === 0) {
          await transaction
            .request()
            .input('orderId', sql.BigInt, ful.OrderID)
            .query(`
              UPDATE dbo.Orders SET Status = 'DELIVERED', UpdatedAt = SYSUTCDATETIME() WHERE OrderID = @orderId;
            `);
        }
      }

      // 4. If transitioning to CANCELLED (release reserved stock if not yet shipped)
      if (targetStatus === 'CANCELLED' && currentStatus !== 'DISPATCHED' && currentStatus !== 'DELIVERED') {
        const itemsRes = await transaction
          .request()
          .input('fId', sql.BigInt, fulfillmentId)
          .input('orderId', sql.BigInt, ful.OrderID)
          .query<{
            SellerProductID: bigint;
            Quantity: number;
          }>(`
            SELECT 
              oi.SellerProductID, 
              COALESCE(fi.Quantity, oi.Quantity) AS Quantity
            FROM dbo.OrderItems oi
            LEFT JOIN dbo.FulfillmentItems fi ON fi.FulfillmentID = @fId AND fi.OrderItemID = oi.OrderItemID
            WHERE fi.FulfillmentID = @fId 
               OR (fi.FulfillmentID IS NULL AND (oi.FulfillmentID = @fId OR oi.OrderID = @orderId));
          `);

        for (const itm of itemsRes.recordset) {
          await transaction
            .request()
            .input('whId', sql.BigInt, warehouseId)
            .input('spId', sql.BigInt, itm.SellerProductID)
            .input('qty', sql.Int, itm.Quantity)
            .input('orderId', sql.BigInt, ful.OrderID)
            .input('fId', sql.BigInt, fulfillmentId)
            .query(`
              UPDATE inv
              SET 
                inv.ReservedQuantity = CASE WHEN inv.ReservedQuantity >= @qty THEN inv.ReservedQuantity - @qty ELSE 0 END,
                inv.UpdatedAt = SYSUTCDATETIME()
              FROM dbo.Inventory inv
              JOIN dbo.WarehouseProducts wp ON inv.WarehouseProductID = wp.WarehouseProductID
              WHERE wp.WarehouseID = @whId AND wp.SellerProductID = @spId;

              -- Mark reservation as CANCELLED
              UPDATE ir
              SET ir.Status = 'CANCELLED', ir.UpdatedAt = SYSUTCDATETIME()
              FROM dbo.InventoryReservations ir
              JOIN dbo.Inventory inv ON ir.InventoryID = inv.InventoryID
              JOIN dbo.WarehouseProducts wp ON inv.WarehouseProductID = wp.WarehouseProductID
              WHERE ir.OrderID = @orderId AND wp.WarehouseID = @whId AND wp.SellerProductID = @spId AND ir.Status = 'RESERVED';

              -- Audit Ledger: Released reservation
              INSERT INTO dbo.InventoryTransactions (
                InventoryID, OrderID, TransactionType, Quantity, Reason, CreatedAt
              )
              SELECT inv.InventoryID, @orderId, 'RESERVATION_RELEASED', @qty, 'Cancelled fulfillment #' + CAST(@fId AS VARCHAR(50)), SYSUTCDATETIME()
              FROM dbo.Inventory inv
              JOIN dbo.WarehouseProducts wp ON inv.WarehouseProductID = wp.WarehouseProductID
              WHERE wp.WarehouseID = @whId AND wp.SellerProductID = @spId;
            `);
        }
      }

      await transaction.commit();

      return {
        success: true,
        fulfillmentId: String(fulfillmentId),
        previousStatus: currentStatus,
        newStatus: targetStatus,
        message: `Order fulfillment status updated to ${targetStatus}`,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Generates or fetches Tax Invoice PDF buffer for this fulfillment
   */
  async getInvoicePdf(warehouseId: bigint, fulfillmentId: bigint) {
    const pool = await getPool();

    const fulRes = await pool
      .request()
      .input('whId', sql.BigInt, warehouseId)
      .input('fId', sql.BigInt, fulfillmentId)
      .query<{
        OrderID: bigint;
        SellerID: bigint;
      }>(`
        SELECT OrderID, SellerID
        FROM dbo.Fulfillments
        WHERE WarehouseID = @whId AND FulfillmentID = @fId;
      `);

    if (fulRes.recordset.length === 0) {
      throw new NotFoundError('Fulfillment record not found for this warehouse');
    }

    const { OrderID, SellerID } = fulRes.recordset[0];
    return await invoicePdfService.generateInvoicePdf(SellerID, OrderID);
  }

  private mapFulfillmentRow(row: any): WarehouseFulfillmentDto {
    let items: FulfillmentItemDto[] = [];
    if (row.ItemsJson) {
      try {
        const parsed = JSON.parse(row.ItemsJson);
        items = parsed.map((it: any) => ({
          orderItemId: String(it.OrderItemID),
          sellerProductId: String(it.SellerProductID),
          productName: it.ProductName || 'Product',
          productCode: it.ProductCode,
          variantName: it.VariantName,
          sku: it.VariantSKU || it.SKU,
          quantity: Number(it.Quantity) || 1,
          unitPrice: Number(it.UnitPrice) || 0,
          totalAmount: Number(it.TotalAmount) || 0,
        }));
      } catch {
        items = [];
      }
    }

    return {
      fulfillmentId: String(row.FulfillmentID),
      orderId: String(row.OrderID),
      orderNumber: row.OrderNumber || `ORD-${row.OrderID}`,
      sellerId: String(row.SellerID),
      warehouseId: String(row.WarehouseID),
      status: row.Status || 'PENDING_PICKUP',
      createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : new Date().toISOString(),
      updatedAt: row.UpdatedAt ? new Date(row.UpdatedAt).toISOString() : undefined,
      customer: {
        firstName: row.CustomerFirstName || 'Customer',
        lastName: row.CustomerLastName || '',
        email: row.CustomerEmail || '',
        phone: row.CustomerPhone || '',
      },
      shippingAddress: {
        recipientName: row.ShippingRecipientName || 'Customer',
        phone: row.ShippingPhone || '',
        addressLine1: row.ShippingAddress1 || 'Address',
        addressLine2: row.ShippingAddress2 || undefined,
        city: row.ShippingCity || '',
        state: row.ShippingState || '',
        postalCode: row.ShippingPostalCode || '',
      },
      invoice: row.InvoiceID
        ? {
            invoiceId: String(row.InvoiceID),
            invoiceNumber: row.InvoiceNumber,
            totalAmount: Number(row.InvoiceTotalAmount) || 0,
            status: row.InvoiceStatus || 'GENERATED',
          }
        : undefined,
      shipment: row.Carrier
        ? {
            carrier: row.Carrier,
            trackingNumber: row.TrackingNumber,
            shippedAt: row.ShippedAt ? new Date(row.ShippedAt).toISOString() : undefined,
          }
        : undefined,
      items,
    };
  }
}

export const warehouseFulfillmentsService = new WarehouseFulfillmentsService();

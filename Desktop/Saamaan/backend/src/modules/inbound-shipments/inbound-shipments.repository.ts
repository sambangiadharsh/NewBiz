import sql from 'mssql';
import { getPool } from '../../database/db.js';
import {
  CreateInboundShipmentInput,
  FinalizeGRNInput,
  InboundShipmentsFilter,
  InboundShipmentStatus,
} from './inbound-shipments.types.js';

export class InboundShipmentsRepository {
  /**
   * Generate an enterprise shipment reference number: INB-YYYYMM-XXXX
   */
  private async generateShipmentNumber(transaction: sql.Transaction): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const countRes = await transaction.request().query(`
      SELECT COUNT(1) AS TotalThisMonth 
      FROM dbo.InboundShipments 
      WHERE ShipmentNumber LIKE 'INB-${yearMonth}-%'
    `);
    const nextSeq = Number(countRes.recordset[0]?.TotalThisMonth || 0) + 1;
    return `INB-${yearMonth}-${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Generate a unique Goods Receipt Note reference: GRN-YYYYMMDD-XXXX
   */
  private async generateGRNNumber(transaction: sql.Transaction): Promise<string> {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const countRes = await transaction.request().query(`
      SELECT COUNT(1) AS TotalToday 
      FROM dbo.InboundShipments 
      WHERE GRNNumber LIKE 'GRN-${dateStr}-%'
    `);
    const nextSeq = Number(countRes.recordset[0]?.TotalToday || 0) + 1;
    return `GRN-${dateStr}-${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Seller creates an Inbound Shipment plan (multi-item)
   */
  async createShipment(
    sellerId: bigint | number,
    data: CreateInboundShipmentInput,
    userId?: bigint | number
  ) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Verify destination warehouse exists and is active
      const whCheck = await transaction
        .request()
        .input('whId', sql.BigInt, data.warehouseId)
        .query(`SELECT WarehouseID, WarehouseName, Status FROM dbo.Warehouses WHERE WarehouseID = @whId`);

      if (whCheck.recordset.length === 0) {
        throw new Error('Destination warehouse not found');
      }

      // 2. Validate all seller products belong to this seller
      const productIds = data.items.map((i) => BigInt(i.sellerProductId));
      const spCheck = await transaction
        .request()
        .input('sellerId', sql.BigInt, sellerId)
        .query(`
          SELECT sp.SellerProductID, sp.SellerSKU, pm.ProductName
          FROM dbo.SellerProducts sp
          JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
          JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
          WHERE sp.SellerID = @sellerId AND sp.SellerProductID IN (${productIds.join(',')})
        `);

      if (spCheck.recordset.length !== productIds.length) {
        throw new Error('One or more selected products are invalid or do not belong to your catalog');
      }

      // 3. Generate sequential shipment reference
      const shipmentNumber = await this.generateShipmentNumber(transaction);

      // 4. Insert header record in InboundShipments
      const insertHeader = await transaction
        .request()
        .input('shipmentNumber', sql.NVarChar(50), shipmentNumber)
        .input('sellerId', sql.BigInt, sellerId)
        .input('warehouseId', sql.BigInt, data.warehouseId)
        .input('status', sql.VarChar(30), 'IN_TRANSIT')
        .input('carrierName', sql.NVarChar(100), data.carrierName || null)
        .input('trackingNumber', sql.NVarChar(150), data.trackingNumber || null)
        .input('boxCount', sql.Int, data.boxCount || 1)
        .input('estimatedArrivalDate', sql.Date, data.estimatedArrivalDate || null)
        .input('notes', sql.NVarChar(sql.MAX), data.notes || null)
        .input('poNumber', sql.NVarChar(100), data.poNumber || null)
        .input('poAmount', sql.Decimal(18, 2), data.poAmount || null)
        .input('poDocUrl', sql.NVarChar(1000), data.poDocumentUrl || null)
        .input('supInvNum', sql.NVarChar(100), data.supplierInvoiceNumber || null)
        .input('invAmount', sql.Decimal(18, 2), data.invoiceAmount || null)
        .input('invDocUrl', sql.NVarChar(1000), data.invoiceDocumentUrl || null)
        .input('createdBy', sql.BigInt, userId || null)
        .query(`
          INSERT INTO dbo.InboundShipments (
            ShipmentNumber, SellerID, WarehouseID, Status,
            CarrierName, TrackingNumber, BoxCount, EstimatedArrivalDate,
            DispatchedAt, Notes, PONumber, POAmount, PODocumentURL,
            SupplierInvoiceNumber, InvoiceAmount, InvoiceDocumentURL,
            CreatedAt, CreatedBy
          )
          OUTPUT INSERTED.InboundShipmentID, INSERTED.ShipmentNumber, INSERTED.CreatedAt
          VALUES (
            @shipmentNumber, @sellerId, @warehouseId, @status,
            @carrierName, @trackingNumber, @boxCount, @estimatedArrivalDate,
            SYSUTCDATETIME(), @notes, @poNumber, @poAmount, @poDocUrl,
            @supInvNum, @invAmount, @invDocUrl,
            SYSUTCDATETIME(), @createdBy
          )
        `);

      const shipmentId = insertHeader.recordset[0].InboundShipmentID;

      // 5. Insert line items
      for (const item of data.items) {
        await transaction
          .request()
          .input('shipmentId', sql.BigInt, shipmentId)
          .input('spId', sql.BigInt, item.sellerProductId)
          .input('expQty', sql.Int, item.expectedQuantity)
          .input('remarks', sql.NVarChar(500), item.remarks || null)
          .query(`
            INSERT INTO dbo.InboundShipmentItems (
              InboundShipmentID, SellerProductID, ExpectedQuantity,
              ReceivedQuantity, DamagedQuantity, ShortageQuantity,
              Remarks, CreatedAt
            )
            VALUES (
              @shipmentId, @spId, @expQty, 0, 0, 0, @remarks, SYSUTCDATETIME()
            )
          `);
      }

      await transaction.commit();

      return {
        inboundShipmentId: String(shipmentId),
        shipmentNumber,
        status: 'IN_TRANSIT',
        itemCount: data.items.length,
        totalExpectedUnits: data.items.reduce((acc, i) => acc + i.expectedQuantity, 0),
        createdAt: insertHeader.recordset[0].CreatedAt,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * List Seller's Inbound Shipments
   */
  async getSellerShipments(sellerId: bigint | number, filters: InboundShipmentsFilter) {
    const pool = await getPool();
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = `WHERE s.SellerID = @sellerId`;
    const request = pool.request().input('sellerId', sql.BigInt, sellerId);

    if (filters.status && filters.status !== 'ALL') {
      request.input('status', sql.VarChar(30), filters.status);
      whereClause += ` AND s.Status = @status`;
    }

    if (filters.warehouseId) {
      request.input('warehouseId', sql.BigInt, filters.warehouseId);
      whereClause += ` AND s.WarehouseID = @warehouseId`;
    }

    if (filters.search) {
      request.input('search', sql.NVarChar(100), `%${filters.search}%`);
      whereClause += ` AND (s.ShipmentNumber LIKE @search OR s.CarrierName LIKE @search OR s.TrackingNumber LIKE @search OR s.GRNNumber LIKE @search)`;
    }

    const query = `
      SELECT 
        s.InboundShipmentID,
        s.ShipmentNumber,
        s.Status,
        s.CarrierName,
        s.TrackingNumber,
        s.BoxCount,
        s.EstimatedArrivalDate,
        s.DispatchedAt,
        s.ReceivedAt,
        s.GRNNumber,
        s.GRNDate,
        s.Notes,
        s.PONumber,
        s.SupplierInvoiceNumber,
        s.CreatedAt,
        w.WarehouseID,
        w.WarehouseName,
        w.WarehouseCode,
        w.City,
        COUNT(item.InboundShipmentItemID) AS TotalLineItems,
        ISNULL(SUM(item.ExpectedQuantity), 0) AS TotalExpectedQuantity,
        ISNULL(SUM(item.ReceivedQuantity), 0) AS TotalReceivedQuantity,
        ISNULL(SUM(item.DamagedQuantity), 0) AS TotalDamagedQuantity,
        ISNULL(SUM(item.ShortageQuantity), 0) AS TotalShortageQuantity,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.InboundShipments s
      JOIN dbo.Warehouses w ON s.WarehouseID = w.WarehouseID
      LEFT JOIN dbo.InboundShipmentItems item ON s.InboundShipmentID = item.InboundShipmentID
      ${whereClause}
      GROUP BY 
        s.InboundShipmentID, s.ShipmentNumber, s.Status, s.CarrierName,
        s.TrackingNumber, s.BoxCount, s.EstimatedArrivalDate, s.DispatchedAt,
        s.ReceivedAt, s.GRNNumber, s.GRNDate, s.Notes, s.PONumber,
        s.SupplierInvoiceNumber, s.CreatedAt, w.WarehouseID, w.WarehouseName,
        w.WarehouseCode, w.City
      ORDER BY s.CreatedAt DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `;

    const result = await request.query(query);
    const totalCount = result.recordset[0]?.TotalCount ? Number(result.recordset[0].TotalCount) : 0;

    return {
      items: result.recordset.map((r) => ({
        inboundShipmentId: String(r.InboundShipmentID),
        shipmentNumber: r.ShipmentNumber,
        status: r.Status as InboundShipmentStatus,
        carrierName: r.CarrierName,
        trackingNumber: r.TrackingNumber,
        boxCount: Number(r.BoxCount || 1),
        estimatedArrivalDate: r.EstimatedArrivalDate,
        dispatchedAt: r.DispatchedAt,
        receivedAt: r.ReceivedAt,
        grnNumber: r.GRNNumber,
        grnDate: r.GRNDate,
        notes: r.Notes,
        poNumber: r.PONumber,
        supplierInvoiceNumber: r.SupplierInvoiceNumber,
        createdAt: r.CreatedAt,
        warehouse: {
          warehouseId: String(r.WarehouseID),
          warehouseName: r.WarehouseName,
          warehouseCode: r.WarehouseCode,
          city: r.City,
        },
        metrics: {
          totalLineItems: Number(r.TotalLineItems),
          totalExpectedQuantity: Number(r.TotalExpectedQuantity),
          totalReceivedQuantity: Number(r.TotalReceivedQuantity),
          totalDamagedQuantity: Number(r.TotalDamagedQuantity),
          totalShortageQuantity: Number(r.TotalShortageQuantity),
        },
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    };
  }

  /**
   * Get Seller Shipment Detail with Line Items & Reconciliation
   */
  async getSellerShipmentById(sellerId: bigint | number, shipmentId: bigint | number) {
    const pool = await getPool();

    // 1. Fetch Header
    const headerRes = await pool
      .request()
      .input('sellerId', sql.BigInt, sellerId)
      .input('shipmentId', sql.BigInt, shipmentId)
      .query(`
        SELECT 
          s.*,
          w.WarehouseName,
          w.WarehouseCode,
          w.AddressLine1,
          w.City,
          w.State,
          w.PostalCode,
          w.ContactPersonName,
          w.ContactPhoneNumber
        FROM dbo.InboundShipments s
        JOIN dbo.Warehouses w ON s.WarehouseID = w.WarehouseID
        WHERE s.InboundShipmentID = @shipmentId AND s.SellerID = @sellerId
      `);

    if (headerRes.recordset.length === 0) {
      return null;
    }

    const header = headerRes.recordset[0];

    // 2. Fetch Line Items
    const itemsRes = await pool
      .request()
      .input('shipmentId', sql.BigInt, shipmentId)
      .query(`
        SELECT 
          i.InboundShipmentItemID,
          i.SellerProductID,
          i.ExpectedQuantity,
          i.ReceivedQuantity,
          i.DamagedQuantity,
          i.ShortageQuantity,
          i.Remarks,
          sp.SellerSKU,
          sp.SellingPrice,
          sp.MRP,
          pm.ProductID,
          pm.ProductName,
          (
            SELECT TOP 1 AssetURL 
            FROM dbo.ProductAssets 
            WHERE ProductVariantID = pv.ProductVariantID AND AssetType = 'IMAGE'
            ORDER BY IsPrimary DESC, DisplayOrder ASC
          ) AS PrimaryImage
        FROM dbo.InboundShipmentItems i
        JOIN dbo.SellerProducts sp ON i.SellerProductID = sp.SellerProductID
        JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
        JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
        WHERE i.InboundShipmentID = @shipmentId
        ORDER BY i.InboundShipmentItemID ASC
      `);

    return {
      inboundShipmentId: String(header.InboundShipmentID),
      shipmentNumber: header.ShipmentNumber,
      status: header.Status as InboundShipmentStatus,
      carrierName: header.CarrierName,
      trackingNumber: header.TrackingNumber,
      boxCount: Number(header.BoxCount || 1),
      estimatedArrivalDate: header.EstimatedArrivalDate,
      dispatchedAt: header.DispatchedAt,
      receivedAt: header.ReceivedAt,
      grnNumber: header.GRNNumber,
      grnDate: header.GRNDate,
      notes: header.Notes,
      poNumber: header.PONumber,
      poAmount: header.POAmount ? Number(header.POAmount) : null,
      poDocumentUrl: header.PODocumentURL,
      supplierInvoiceNumber: header.SupplierInvoiceNumber,
      invoiceAmount: header.InvoiceAmount ? Number(header.InvoiceAmount) : null,
      invoiceDocumentUrl: header.InvoiceDocumentURL,
      grnAmount: header.GRNAmount ? Number(header.GRNAmount) : null,
      grnDocumentUrl: header.GRNDocumentURL,
      createdAt: header.CreatedAt,
      warehouse: {
        warehouseId: String(header.WarehouseID),
        warehouseName: header.WarehouseName,
        warehouseCode: header.WarehouseCode,
        address: `${header.AddressLine1}, ${header.City}, ${header.State} - ${header.PostalCode}`,
        contactPerson: header.ContactPersonName,
        contactPhone: header.ContactPhoneNumber,
      },
      items: itemsRes.recordset.map((item) => ({
        inboundShipmentItemId: String(item.InboundShipmentItemID),
        sellerProductId: String(item.SellerProductID),
        productId: String(item.ProductID),
        productName: item.ProductName,
        sellerSku: item.SellerSKU,
        primaryImage: item.PrimaryImage,
        expectedQuantity: Number(item.ExpectedQuantity),
        receivedQuantity: Number(item.ReceivedQuantity),
        damagedQuantity: Number(item.DamagedQuantity),
        shortageQuantity: Number(item.ShortageQuantity),
        purchasePrice: Number(item.PurchasePrice || 0),
        remarks: item.Remarks,
      })),
    };
  }

  /**
   * Cancel Shipment (only if currently IN_TRANSIT)
   */
  async cancelShipment(sellerId: bigint | number, shipmentId: bigint | number, reason?: string) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('sellerId', sql.BigInt, sellerId)
      .input('shipmentId', sql.BigInt, shipmentId)
      .input('reason', sql.NVarChar(500), reason || 'Cancelled by seller')
      .query(`
        UPDATE dbo.InboundShipments
        SET Status = 'CANCELLED',
            Notes = ISNULL(Notes + ' | ', '') + 'Cancellation reason: ' + @reason,
            UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.InboundShipmentID, INSERTED.Status
        WHERE InboundShipmentID = @shipmentId AND SellerID = @sellerId AND Status = 'IN_TRANSIT'
      `);

    if (result.recordset.length === 0) {
      throw new Error('Shipment cannot be cancelled. It may have already been received or does not exist.');
    }

    return { success: true, status: 'CANCELLED' };
  }

  /**
   * List Warehouse Inbound Shipments
   */
  async getWarehouseShipments(warehouseId: bigint | number, filters: InboundShipmentsFilter) {
    const pool = await getPool();
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = `WHERE s.WarehouseID = @warehouseId`;
    const request = pool.request().input('warehouseId', sql.BigInt, warehouseId);

    if (filters.status && filters.status !== 'ALL') {
      request.input('status', sql.VarChar(30), filters.status);
      whereClause += ` AND s.Status = @status`;
    }

    if (filters.search) {
      request.input('search', sql.NVarChar(100), `%${filters.search}%`);
      whereClause += ` AND (s.ShipmentNumber LIKE @search OR s.CarrierName LIKE @search OR s.TrackingNumber LIKE @search OR sel.SellerName LIKE @search OR s.GRNNumber LIKE @search)`;
    }

    const query = `
      SELECT 
        s.InboundShipmentID,
        s.ShipmentNumber,
        s.Status,
        s.CarrierName,
        s.TrackingNumber,
        s.BoxCount,
        s.EstimatedArrivalDate,
        s.DispatchedAt,
        s.ReceivedAt,
        s.GRNNumber,
        s.GRNDate,
        s.Notes,
        s.CreatedAt,
        sel.SellerID,
        sel.SellerName,
        sel.SellerCode,
        sel.BusinessName,
        COUNT(item.InboundShipmentItemID) AS TotalLineItems,
        ISNULL(SUM(item.ExpectedQuantity), 0) AS TotalExpectedQuantity,
        ISNULL(SUM(item.ReceivedQuantity), 0) AS TotalReceivedQuantity,
        ISNULL(SUM(item.DamagedQuantity), 0) AS TotalDamagedQuantity,
        ISNULL(SUM(item.ShortageQuantity), 0) AS TotalShortageQuantity,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.InboundShipments s
      JOIN dbo.Sellers sel ON s.SellerID = sel.SellerID
      LEFT JOIN dbo.InboundShipmentItems item ON s.InboundShipmentID = item.InboundShipmentID
      ${whereClause}
      GROUP BY 
        s.InboundShipmentID, s.ShipmentNumber, s.Status, s.CarrierName,
        s.TrackingNumber, s.BoxCount, s.EstimatedArrivalDate, s.DispatchedAt,
        s.ReceivedAt, s.GRNNumber, s.GRNDate, s.Notes, s.CreatedAt,
        sel.SellerID, sel.SellerName, sel.SellerCode, sel.BusinessName
      ORDER BY 
        CASE WHEN s.Status = 'IN_TRANSIT' THEN 1 ELSE 2 END ASC,
        s.CreatedAt DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `;

    const result = await request.query(query);
    const totalCount = result.recordset[0]?.TotalCount ? Number(result.recordset[0].TotalCount) : 0;

    return {
      items: result.recordset.map((r) => ({
        inboundShipmentId: String(r.InboundShipmentID),
        shipmentNumber: r.ShipmentNumber,
        status: r.Status as InboundShipmentStatus,
        carrierName: r.CarrierName,
        trackingNumber: r.TrackingNumber,
        boxCount: Number(r.BoxCount || 1),
        estimatedArrivalDate: r.EstimatedArrivalDate,
        dispatchedAt: r.DispatchedAt,
        receivedAt: r.ReceivedAt,
        grnNumber: r.GRNNumber,
        grnDate: r.GRNDate,
        notes: r.Notes,
        createdAt: r.CreatedAt,
        seller: {
          sellerId: String(r.SellerID),
          sellerName: r.SellerName,
          sellerCode: r.SellerCode,
          businessName: r.BusinessName,
        },
        metrics: {
          totalLineItems: Number(r.TotalLineItems),
          totalExpectedQuantity: Number(r.TotalExpectedQuantity),
          totalReceivedQuantity: Number(r.TotalReceivedQuantity),
          totalDamagedQuantity: Number(r.TotalDamagedQuantity),
          totalShortageQuantity: Number(r.TotalShortageQuantity),
        },
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    };
  }

  /**
   * Get Warehouse Shipment detail for Receiving/QC inspection
   */
  async getWarehouseShipmentById(warehouseId: bigint | number, shipmentId: bigint | number) {
    const pool = await getPool();

    const headerRes = await pool
      .request()
      .input('whId', sql.BigInt, warehouseId)
      .input('shipmentId', sql.BigInt, shipmentId)
      .query(`
        SELECT 
          s.*,
          sel.SellerName,
          sel.SellerCode,
          sel.BusinessName,
          sel.Email,
          sel.PhoneNumber
        FROM dbo.InboundShipments s
        JOIN dbo.Sellers sel ON s.SellerID = sel.SellerID
        WHERE s.InboundShipmentID = @shipmentId AND s.WarehouseID = @whId
      `);

    if (headerRes.recordset.length === 0) {
      return null;
    }

    const header = headerRes.recordset[0];

    const itemsRes = await pool
      .request()
      .input('shipmentId', sql.BigInt, shipmentId)
      .query(`
        SELECT 
          i.InboundShipmentItemID,
          i.SellerProductID,
          i.ExpectedQuantity,
          i.ReceivedQuantity,
          i.DamagedQuantity,
          i.ShortageQuantity,
          i.Remarks,
          sp.SellerSKU,
          ISNULL(sp.PurchasePrice, 0) AS PurchasePrice,
          pm.ProductID,
          pm.ProductName,
          (
            SELECT TOP 1 AssetURL 
            FROM dbo.ProductAssets 
            WHERE ProductVariantID = pv.ProductVariantID AND AssetType = 'IMAGE'
            ORDER BY IsPrimary DESC, DisplayOrder ASC
          ) AS PrimaryImage
        FROM dbo.InboundShipmentItems i
        JOIN dbo.SellerProducts sp ON i.SellerProductID = sp.SellerProductID
        JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
        JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
        WHERE i.InboundShipmentID = @shipmentId
        ORDER BY i.InboundShipmentItemID ASC
      `);

    return {
      inboundShipmentId: String(header.InboundShipmentID),
      shipmentNumber: header.ShipmentNumber,
      status: header.Status as InboundShipmentStatus,
      carrierName: header.CarrierName,
      trackingNumber: header.TrackingNumber,
      boxCount: Number(header.BoxCount || 1),
      estimatedArrivalDate: header.EstimatedArrivalDate,
      dispatchedAt: header.DispatchedAt,
      receivedAt: header.ReceivedAt,
      grnNumber: header.GRNNumber,
      grnDate: header.GRNDate,
      notes: header.Notes,
      poNumber: header.PONumber,
      supplierInvoiceNumber: header.SupplierInvoiceNumber,
      createdAt: header.CreatedAt,
      seller: {
        sellerId: String(header.SellerID),
        sellerName: header.SellerName,
        sellerCode: header.SellerCode,
        businessName: header.BusinessName,
        email: header.Email,
        phone: header.PhoneNumber,
      },
      items: itemsRes.recordset.map((item) => ({
        inboundShipmentItemId: String(item.InboundShipmentItemID),
        sellerProductId: String(item.SellerProductID),
        productId: String(item.ProductID),
        productName: item.ProductName,
        sellerSku: item.SellerSKU,
        primaryImage: item.PrimaryImage,
        expectedQuantity: Number(item.ExpectedQuantity),
        receivedQuantity: Number(item.ReceivedQuantity),
        damagedQuantity: Number(item.DamagedQuantity),
        shortageQuantity: Number(item.ShortageQuantity),
        purchasePrice: Number(item.PurchasePrice || 0),
        remarks: item.Remarks,
      })),
    };
  }

  /**
   * Finalize GRN & Post Stock (Atomic Transaction)
   * Updates line items, increments inventory, writes to audit ledger,
   * and sets status to RECEIVED or DISCREPANCY.
   */
  async receiveAndFinalizeGRN(
    warehouseId: bigint | number,
    shipmentId: bigint | number,
    input: FinalizeGRNInput,
    userId?: bigint | number
  ) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Verify shipment exists, is assigned to this warehouse, and is IN_TRANSIT
      const shipmentCheck = await transaction
        .request()
        .input('whId', sql.BigInt, warehouseId)
        .input('shipmentId', sql.BigInt, shipmentId)
        .query(`
          SELECT InboundShipmentID, ShipmentNumber, Status, SellerID 
          FROM dbo.InboundShipments WITH (UPDLOCK)
          WHERE InboundShipmentID = @shipmentId AND WarehouseID = @whId
        `);

      if (shipmentCheck.recordset.length === 0) {
        throw new Error('Inbound shipment not found or not assigned to this warehouse');
      }

      const shipment = shipmentCheck.recordset[0];
      if (shipment.Status !== 'IN_TRANSIT') {
        throw new Error(`Cannot process GRN for shipment in '${shipment.Status}' status. Only 'IN_TRANSIT' shipments can be received.`);
      }

      // 2. Fetch expected line items with product details & purchase price
      const existingItemsRes = await transaction
        .request()
        .input('shipmentId', sql.BigInt, shipmentId)
        .query(`
          SELECT 
            isi.InboundShipmentItemID, 
            isi.SellerProductID, 
            isi.ExpectedQuantity,
            sp.SellerSKU,
            ISNULL(sp.PurchasePrice, 0) AS PurchasePrice,
            pm.ProductName
          FROM dbo.InboundShipmentItems isi
          JOIN dbo.SellerProducts sp ON isi.SellerProductID = sp.SellerProductID
          JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
          JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
          WHERE isi.InboundShipmentID = @shipmentId
        `);

      const existingItemsMap = new Map<string, { expected: number; spId: bigint; sku: string; price: number; name: string }>();
      for (const row of existingItemsRes.recordset) {
        existingItemsMap.set(String(row.InboundShipmentItemID), {
          expected: Number(row.ExpectedQuantity),
          spId: BigInt(row.SellerProductID),
          sku: String(row.SellerSKU || ''),
          price: Number(row.PurchasePrice || 0),
          name: String(row.ProductName || ''),
        });
      }

      // 3. Generate GRN Reference
      const grnNumber = await this.generateGRNNumber(transaction);

      let hasDiscrepancy = false;
      let totalGoodUnits = 0;
      let totalDamagedUnits = 0;
      let totalCalculatedAmount = 0;

      // 4. Process each received item
      for (const itemInput of input.items) {
        const itemMeta = existingItemsMap.get(String(itemInput.inboundShipmentItemId));
        if (!itemMeta) {
          throw new Error(`Item ${itemInput.inboundShipmentItemId} does not belong to this shipment`);
        }

        const receivedQty = Math.max(0, Number(itemInput.receivedQuantity) || 0);
        const damagedQty = Math.max(0, Number(itemInput.damagedQuantity) || 0);

        // Strict Edge Case: Good + Damaged cannot exceed Expected Declared Units
        if (receivedQty + damagedQty > itemMeta.expected) {
          throw new Error(
            `Total verified units (${receivedQty} good + ${damagedQty} damaged = ${receivedQty + damagedQty}) cannot exceed declared expected units (${itemMeta.expected}) for ${itemMeta.name} (SKU: ${itemMeta.sku})`
          );
        }

        const shortageQty = itemMeta.expected - (receivedQty + damagedQty);

        if (damagedQty > 0 || shortageQty > 0) {
          hasDiscrepancy = true;
        }

        totalGoodUnits += receivedQty;
        totalDamagedUnits += damagedQty;
        totalCalculatedAmount += (receivedQty * itemMeta.price);

        const cleanRemarks = itemInput.remarks ? itemInput.remarks.trim().slice(0, 250) : null;

        // Update line item counts
        await transaction
          .request()
          .input('itemId', sql.BigInt, itemInput.inboundShipmentItemId)
          .input('recQty', sql.Int, receivedQty)
          .input('dmgQty', sql.Int, damagedQty)
          .input('shortQty', sql.Int, shortageQty)
          .input('remarks', sql.NVarChar(500), cleanRemarks)
          .query(`
            UPDATE dbo.InboundShipmentItems
            SET ReceivedQuantity = @recQty,
                DamagedQuantity = @dmgQty,
                ShortageQuantity = @shortQty,
                Remarks = @remarks,
                UpdatedAt = SYSUTCDATETIME()
            WHERE InboundShipmentItemID = @itemId
          `);

        // Find or create WarehouseProducts shelf
        let wpId: bigint;
        const wpCheck = await transaction
          .request()
          .input('spId', sql.BigInt, itemMeta.spId)
          .input('whId', sql.BigInt, warehouseId)
          .query(`
            SELECT WarehouseProductID 
            FROM dbo.WarehouseProducts 
            WHERE SellerProductID = @spId AND WarehouseID = @whId
          `);

        if (wpCheck.recordset.length > 0) {
          wpId = BigInt(wpCheck.recordset[0].WarehouseProductID);
        } else {
          const insertWp = await transaction
            .request()
            .input('spId', sql.BigInt, itemMeta.spId)
            .input('whId', sql.BigInt, warehouseId)
            .input('whSku', sql.NVarChar(100), `WH-SP${itemMeta.spId}`)
            .input('userId', sql.BigInt, userId || null)
            .query(`
              INSERT INTO dbo.WarehouseProducts (
                WarehouseID, SellerProductID, WarehouseSKU, Status, CreatedAt, CreatedBy
              )
              OUTPUT INSERTED.WarehouseProductID
              VALUES (@whId, @spId, @whSku, 'ACTIVE', SYSUTCDATETIME(), @userId)
            `);
          wpId = BigInt(insertWp.recordset[0].WarehouseProductID);
        }

        // Find or create Inventory record
        let invId: bigint;
        const invCheck = await transaction
          .request()
          .input('wpId', sql.BigInt, wpId)
          .query(`
            SELECT InventoryID, PhysicalQuantity, DamagedQuantity 
            FROM dbo.Inventory WITH (UPDLOCK)
            WHERE WarehouseProductID = @wpId
          `);

        let balanceBefore = 0;
        let balanceAfter = 0;

        if (invCheck.recordset.length === 0) {
          balanceBefore = 0;
          balanceAfter = receivedQty;
          const insertInv = await transaction
            .request()
            .input('wpId', sql.BigInt, wpId)
            .input('physQty', sql.Int, receivedQty)
            .input('dmgQty', sql.Int, damagedQty)
            .input('userId', sql.BigInt, userId || null)
            .query<{ InventoryID: bigint }>(`
              INSERT INTO dbo.Inventory (
                WarehouseProductID, PhysicalQuantity, ReservedQuantity,
                DamagedQuantity, SafetyStockQuantity, UpdatedAt, UpdatedBy
              )
              OUTPUT INSERTED.InventoryID
              VALUES (@wpId, @physQty, 0, @dmgQty, 15, SYSUTCDATETIME(), @userId)
            `);
          invId = BigInt(insertInv.recordset[0].InventoryID);
        } else {
          invId = BigInt(invCheck.recordset[0].InventoryID);
          const currentPhys = Number(invCheck.recordset[0].PhysicalQuantity || 0);
          const currentDmg = Number(invCheck.recordset[0].DamagedQuantity || 0);
          balanceBefore = currentPhys;
          balanceAfter = currentPhys + receivedQty;

          await transaction
            .request()
            .input('invId', sql.BigInt, invId)
            .input('newPhys', sql.Int, balanceAfter)
            .input('newDmg', sql.Int, currentDmg + damagedQty)
            .input('userId', sql.BigInt, userId || null)
            .query(`
              UPDATE dbo.Inventory
              SET PhysicalQuantity = @newPhys,
                  DamagedQuantity = @newDmg,
                  UpdatedAt = SYSUTCDATETIME(),
                  UpdatedBy = @userId
              WHERE InventoryID = @invId
            `);
        }

        // Insert audit ledger row into InventoryTransactions for good stock
        if (receivedQty > 0) {
          await transaction
            .request()
            .input('invId', sql.BigInt, invId)
            .input('inbId', sql.BigInt, shipmentId)
            .input('qty', sql.Int, receivedQty)
            .input('balBefore', sql.Int, balanceBefore)
            .input('balAfter', sql.Int, balanceAfter)
            .input('reason', sql.NVarChar(500), `GRN ${grnNumber} Inbound Stock Receipt`)
            .input('userId', sql.BigInt, userId || null)
            .query(`
              INSERT INTO dbo.InventoryTransactions (
                InventoryID, InboundShipmentID, OrderID, TransactionType,
                Quantity, BalanceBefore, BalanceAfter, Reason, CreatedAt, CreatedBy
              )
              VALUES (
                @invId, @inbId, NULL, 'INBOUND',
                @qty, @balBefore, @balAfter, @reason, SYSUTCDATETIME(), @userId
              )
            `);
        }

        // If damaged units exist, record damage ledger entry
        if (damagedQty > 0) {
          await transaction
            .request()
            .input('invId', sql.BigInt, invId)
            .input('inbId', sql.BigInt, shipmentId)
            .input('qty', sql.Int, damagedQty)
            .input('balBefore', sql.Int, balanceAfter)
            .input('balAfter', sql.Int, balanceAfter)
            .input('reason', sql.NVarChar(500), `GRN ${grnNumber} Inbound Damaged Stock`)
            .input('userId', sql.BigInt, userId || null)
            .query(`
              INSERT INTO dbo.InventoryTransactions (
                InventoryID, InboundShipmentID, OrderID, TransactionType,
                Quantity, BalanceBefore, BalanceAfter, Reason, CreatedAt, CreatedBy
              )
              VALUES (
                @invId, @inbId, NULL, 'DAMAGE',
                @qty, @balBefore, @balAfter, @reason, SYSUTCDATETIME(), @userId
              )
            `);
        }
      }

      // 5. Determine Final Status (lean 4-status model)
      const finalStatus: InboundShipmentStatus = hasDiscrepancy ? 'DISCREPANCY' : 'RECEIVED';
      const cleanNotes = input.grnNotes ? input.grnNotes.trim().slice(0, 500) : null;
      const generatedGrnDocUrl = `/api/v1/warehouse/inbound-shipments/${shipmentId}/grn/pdf`;

      // 6. Update Shipment Header
      await transaction
        .request()
        .input('shipmentId', sql.BigInt, shipmentId)
        .input('status', sql.VarChar(30), finalStatus)
        .input('grnNum', sql.NVarChar(100), grnNumber)
        .input('grnAmt', sql.Decimal(18, 2), totalCalculatedAmount)
        .input('grnDocUrl', sql.NVarChar(1000), generatedGrnDocUrl)
        .input('notes', sql.NVarChar(sql.MAX), cleanNotes)
        .input('userId', sql.BigInt, userId || null)
        .query(`
          UPDATE dbo.InboundShipments
          SET Status = @status,
              GRNNumber = @grnNum,
              GRNDate = SYSUTCDATETIME(),
              ReceivedAt = SYSUTCDATETIME(),
              GRNAmount = @grnAmt,
              GRNDocumentURL = @grnDocUrl,
              Notes = CASE 
                WHEN @notes IS NOT NULL THEN ISNULL(Notes + ' | ', '') + @notes
                ELSE Notes 
              END,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @userId
          WHERE InboundShipmentID = @shipmentId
        `);

      await transaction.commit();

      return {
        shipmentId: String(shipmentId),
        shipmentNumber: shipment.ShipmentNumber,
        grnNumber,
        status: finalStatus,
        totalGoodUnitsAdded: totalGoodUnits,
        totalDamagedUnits: totalDamagedUnits,
        grnAmount: totalCalculatedAmount,
        hasDiscrepancy,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Get full details for generating Digital GRN PDF
   */
  async getInboundShipmentGRNDetails(shipmentId: bigint | number) {
    const pool = await getPool();

    const headerRes = await pool
      .request()
      .input('shipmentId', sql.BigInt, shipmentId)
      .query(`
        SELECT 
          s.InboundShipmentID,
          s.ShipmentNumber,
          s.Status,
          s.GRNNumber,
          s.GRNDate,
          s.GRNAmount,
          s.ReceivedAt,
          s.DispatchedAt,
          s.CarrierName,
          s.TrackingNumber,
          s.BoxCount,
          s.EstimatedArrivalDate,
          s.Notes,
          s.PONumber,
          s.SupplierInvoiceNumber,
          w.WarehouseID,
          w.WarehouseName,
          w.WarehouseCode,
          w.WarehouseType,
          w.AddressLine1,
          w.AddressLine2,
          w.City,
          w.State,
          w.PostalCode,
          w.Country,
          w.ContactPersonName,
          w.ContactPhoneNumber,
          w.ContactEmail,
          sel.SellerID,
          sel.SellerName,
          sel.BusinessName,
          sel.SellerCode,
          sel.Email AS SellerEmail,
          sel.PhoneNumber AS SellerPhone
        FROM dbo.InboundShipments s
        JOIN dbo.Warehouses w ON s.WarehouseID = w.WarehouseID
        JOIN dbo.Sellers sel ON s.SellerID = sel.SellerID
        WHERE s.InboundShipmentID = @shipmentId
      `);

    if (headerRes.recordset.length === 0) {
      return null;
    }

    const h = headerRes.recordset[0];

    const itemsRes = await pool
      .request()
      .input('shipmentId', sql.BigInt, shipmentId)
      .query(`
        SELECT 
          isi.InboundShipmentItemID,
          isi.SellerProductID,
          isi.ExpectedQuantity,
          isi.ReceivedQuantity,
          isi.DamagedQuantity,
          isi.ShortageQuantity,
          isi.Remarks,
          sp.SellerSKU,
          pv.VariantSKU,
          ISNULL(sp.PurchasePrice, 0) AS PurchasePrice,
          pm.ProductName
        FROM dbo.InboundShipmentItems isi
        JOIN dbo.SellerProducts sp ON isi.SellerProductID = sp.SellerProductID
        JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
        JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
        WHERE isi.InboundShipmentID = @shipmentId
        ORDER BY isi.InboundShipmentItemID ASC
      `);

    return {
      inboundShipmentId: String(h.InboundShipmentID),
      shipmentNumber: h.ShipmentNumber,
      status: h.Status as InboundShipmentStatus,
      grnNumber: h.GRNNumber,
      grnDate: h.GRNDate,
      grnAmount: Number(h.GRNAmount || 0),
      receivedAt: h.ReceivedAt,
      dispatchedAt: h.DispatchedAt,
      carrierName: h.CarrierName,
      trackingNumber: h.TrackingNumber,
      boxCount: Number(h.BoxCount || 1),
      notes: h.Notes,
      poNumber: h.PONumber,
      supplierInvoiceNumber: h.SupplierInvoiceNumber,
      warehouse: {
        warehouseId: String(h.WarehouseID),
        warehouseName: h.WarehouseName,
        warehouseCode: h.WarehouseCode,
        warehouseType: h.WarehouseType,
        addressLine1: h.AddressLine1,
        addressLine2: h.AddressLine2,
        city: h.City,
        state: h.State,
        postalCode: h.PostalCode,
        country: h.Country,
        contactPersonName: h.ContactPersonName,
        contactPhoneNumber: h.ContactPhoneNumber,
        contactEmail: h.ContactEmail,
      },
      seller: {
        sellerId: String(h.SellerID),
        sellerName: h.SellerName,
        sellerCode: h.SellerCode,
        businessName: h.BusinessName,
        email: h.SellerEmail,
        phoneNumber: h.SellerPhone,
      },
      items: itemsRes.recordset.map((r: any) => ({
        inboundShipmentItemId: String(r.InboundShipmentItemID),
        sellerProductId: String(r.SellerProductID),
        expectedQuantity: Number(r.ExpectedQuantity || 0),
        receivedQuantity: Number(r.ReceivedQuantity || 0),
        damagedQuantity: Number(r.DamagedQuantity || 0),
        shortageQuantity: Number(r.ShortageQuantity || 0),
        purchasePrice: Number(r.PurchasePrice || 0),
        remarks: r.Remarks,
        sellerSku: r.SellerSKU,
        systemSku: r.VariantSKU,
        productName: r.ProductName,
      })),
    };
  }
}

export const inboundShipmentsRepository = new InboundShipmentsRepository();

import { getPool, sql } from '../../database/db.js';

export interface InventoryGridFilters {
  warehouseId?: bigint | number;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  search?: string;
  page?: number;
  limit?: number;
}

export interface InboundStockData {
  warehouseProductId?: bigint | number;
  sellerProductId?: bigint | number;
  warehouseId?: bigint | number;
  quantity: number;
  reason?: string;
  poNumber?: string;
  poAmount?: number;
  poDocumentUrl?: string;
  grnNumber?: string;
  grnAmount?: number;
  grnDocumentUrl?: string;
  supplierInvoiceNumber?: string;
  invoiceAmount?: number;
  invoiceDocumentUrl?: string;
}

export class InventoryRepository {
  /**
   * Retrieves high-level inventory metrics across all facilities (or a specific warehouse) for this seller.
   */
  async getInventorySummary(sellerId: bigint | number, warehouseId?: bigint | number) {
    const pool = await getPool();

    const request = pool
      .request()
      .input('sellerId', sql.BigInt, sellerId);

    let warehouseFilter = '';
    if (warehouseId) {
      request.input('warehouseId', sql.BigInt, warehouseId);
      warehouseFilter = ' AND wp.WarehouseID = @warehouseId';
    }

    const result = await request.query(`
        SELECT 
          COUNT(DISTINCT sp.SellerProductID) AS TotalListedProducts,
          COUNT(DISTINCT wp.WarehouseProductID) AS TotalStockedShelves,
          COUNT(DISTINCT wp.WarehouseID) AS ActiveWarehousesCount,
          ISNULL(SUM(CAST(i.PhysicalQuantity AS bigint)), 0) AS TotalPhysicalUnits,
          ISNULL(SUM(CAST(i.ReservedQuantity AS bigint)), 0) AS TotalReservedUnits,
          ISNULL(SUM(CAST(i.DamagedQuantity AS bigint)), 0) AS TotalDamagedUnits,
          ISNULL(SUM(CAST(CASE 
            WHEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) > 0 
            THEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) 
            ELSE 0 
          END AS bigint)), 0) AS TotalAvailableUnits,
          ISNULL(SUM(CASE 
            WHEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= 0 THEN 1 
            ELSE 0 
          END), 0) AS OutOfStockCount,
          ISNULL(SUM(CASE 
            WHEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) > 0 
                 AND (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= CASE WHEN ISNULL(i.SafetyStockQuantity, 0) > 0 THEN i.SafetyStockQuantity ELSE 15 END 
            THEN 1 
            ELSE 0 
          END), 0) AS LowStockCount,
          ISNULL(SUM(CASE 
            WHEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) > CASE WHEN ISNULL(i.SafetyStockQuantity, 0) > 0 THEN i.SafetyStockQuantity ELSE 15 END 
            THEN 1 
            ELSE 0 
          END), 0) AS HealthyStockCount
        FROM dbo.SellerProducts sp
        JOIN dbo.WarehouseProducts wp ON sp.SellerProductID = wp.SellerProductID
        LEFT JOIN dbo.Inventory i ON wp.WarehouseProductID = i.WarehouseProductID
        WHERE sp.SellerID = @sellerId${warehouseFilter};
      `);

    return result.recordset[0];
  }

  /**
   * Retrieves multi-warehouse inventory rows with live shelf calculations.
   */
  async getInventoryGrid(sellerId: bigint | number, filters: InventoryGridFilters) {
    const pool = await getPool();
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        wp.WarehouseProductID,
        wp.SellerProductID,
        wp.WarehouseID,
        wp.Status AS WarehouseProductStatus,
        CASE WHEN wp.Status = 'ACTIVE' THEN 1 ELSE 0 END AS IsAvailableForSale,
        w.WarehouseName,
        w.WarehouseCode,
        w.City AS WarehouseCity,
        w.State AS WarehouseState,
        sp.SellerSKU,
        sp.SellingPrice,
        sp.PurchasePrice,
        sp.MRP,
        sp.Status AS SellerProductStatus,
        pm.ProductID,
        pm.ProductName,
        pm.ProductName AS ProductTitle,
        pm.BrandID,
        b.BrandName,
        c.CategoryName,
        i.InventoryID,
        ISNULL(i.PhysicalQuantity, 0) AS PhysicalQuantity,
        ISNULL(i.ReservedQuantity, 0) AS ReservedQuantity,
        ISNULL(i.DamagedQuantity, 0) AS DamagedQuantity,
        CASE WHEN ISNULL(i.SafetyStockQuantity, 0) > 0 THEN i.SafetyStockQuantity ELSE 15 END AS SafetyStockQuantity,
        (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) AS AvailableQuantity,
        CASE 
          WHEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= 0 THEN 'OUT_OF_STOCK'
          WHEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= CASE WHEN ISNULL(i.SafetyStockQuantity, 0) > 0 THEN i.SafetyStockQuantity ELSE 15 END THEN 'LOW_STOCK'
          ELSE 'IN_STOCK'
        END AS StockStatus,
        i.UpdatedAt AS InventoryUpdatedAt,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.SellerProducts sp
      JOIN dbo.WarehouseProducts wp ON sp.SellerProductID = wp.SellerProductID
      JOIN dbo.Warehouses w ON wp.WarehouseID = w.WarehouseID
      JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
      JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
      LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
      OUTER APPLY (
        SELECT TOP 1 cat.CategoryName 
        FROM dbo.ProductCategories pc 
        JOIN dbo.Categories cat ON pc.CategoryID = cat.CategoryID 
        WHERE pc.ProductID = pm.ProductID
      ) c
      LEFT JOIN dbo.Inventory i ON wp.WarehouseProductID = i.WarehouseProductID
      WHERE sp.SellerID = @sellerId
    `;

    const request = pool.request().input('sellerId', sql.BigInt, sellerId);

    if (filters.warehouseId) {
      request.input('warehouseId', sql.BigInt, filters.warehouseId);
      query += ` AND wp.WarehouseID = @warehouseId`;
    }

    if (filters.search && filters.search.trim()) {
      request.input('search', sql.NVarChar, `%${filters.search.trim()}%`);
      query += ` AND (
        pm.ProductName LIKE @search OR 
        sp.SellerSKU LIKE @search OR 
        b.BrandName LIKE @search OR 
        w.WarehouseName LIKE @search
      )`;
    }

    if (filters.stockStatus) {
      if (filters.stockStatus === 'OUT_OF_STOCK') {
        query += ` AND (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= 0`;
      } else if (filters.stockStatus === 'LOW_STOCK') {
        query += ` AND (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) > 0 
                   AND (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= CASE WHEN ISNULL(i.SafetyStockQuantity, 0) > 0 THEN i.SafetyStockQuantity ELSE 15 END`;
      } else if (filters.stockStatus === 'IN_STOCK') {
        query += ` AND (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) > CASE WHEN ISNULL(i.SafetyStockQuantity, 0) > 0 THEN i.SafetyStockQuantity ELSE 15 END`;
      }
    }

    query += `
      ORDER BY 
        CASE 
          WHEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= 0 THEN 1
          WHEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= CASE WHEN ISNULL(i.SafetyStockQuantity, 0) > 0 THEN i.SafetyStockQuantity ELSE 15 END THEN 2
          ELSE 3
        END ASC,
        wp.WarehouseProductID DESC
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
        WarehouseProductID: String(row.WarehouseProductID),
        SellerProductID: String(row.SellerProductID),
        WarehouseID: String(row.WarehouseID),
        ProductID: String(row.ProductID),
        BrandID: row.BrandID ? String(row.BrandID) : null,
        InventoryID: row.InventoryID ? String(row.InventoryID) : null,
      })),
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * Creates an inbound stock notice / replenishment transaction, atomically updating Inventory.PhysicalQuantity.
   */
  async createInboundStockNotice(
    sellerId: bigint | number,
    data: InboundStockData,
    userId?: bigint | number
  ) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Resolve WarehouseProductID
      let resolvedWpId: bigint;

      if (data.warehouseProductId) {
        resolvedWpId = BigInt(data.warehouseProductId);
        const wpCheck = await transaction
          .request()
          .input('wpId', sql.BigInt, resolvedWpId)
          .input('sellerId', sql.BigInt, sellerId)
          .query(`
            SELECT wp.WarehouseProductID, wp.WarehouseID, sp.SellerProductID, sp.SellerSKU, pm.ProductName
            FROM dbo.WarehouseProducts wp
            JOIN dbo.SellerProducts sp ON wp.SellerProductID = sp.SellerProductID
            JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
            JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
            WHERE wp.WarehouseProductID = @wpId AND sp.SellerID = @sellerId
          `);

        if (wpCheck.recordset.length === 0) {
          throw new Error('Warehouse product shelf not found or not owned by your seller account');
        }
      } else if (data.sellerProductId && data.warehouseId) {
        const findWp = await transaction
          .request()
          .input('spId', sql.BigInt, data.sellerProductId)
          .input('whId', sql.BigInt, data.warehouseId)
          .input('sellerId', sql.BigInt, sellerId)
          .query(`
            SELECT wp.WarehouseProductID
            FROM dbo.WarehouseProducts wp
            JOIN dbo.SellerProducts sp ON wp.SellerProductID = sp.SellerProductID
            WHERE sp.SellerProductID = @spId AND wp.WarehouseID = @whId AND sp.SellerID = @sellerId
          `);

        if (findWp.recordset.length > 0) {
          resolvedWpId = BigInt(findWp.recordset[0].WarehouseProductID);
        } else {
          // Verify seller product belongs to this seller
          const spCheck = await transaction
            .request()
            .input('spId', sql.BigInt, data.sellerProductId)
            .input('sellerId', sql.BigInt, sellerId)
            .query(`SELECT SellerProductID, SellerSKU FROM dbo.SellerProducts WHERE SellerProductID = @spId AND SellerID = @sellerId`);

          if (spCheck.recordset.length === 0) {
            throw new Error('Product not found in your seller catalog');
          }

          const sellerSku = spCheck.recordset[0].SellerSKU || `SP-${data.sellerProductId}`;
          const generatedWhSku = `WH-${sellerSku}`;

          const insertWp = await transaction
            .request()
            .input('spId', sql.BigInt, data.sellerProductId)
            .input('whId', sql.BigInt, data.warehouseId)
            .input('whSku', sql.NVarChar(100), generatedWhSku)
            .input('userId', sql.BigInt, userId || null)
            .query(`
              INSERT INTO dbo.WarehouseProducts (WarehouseID, SellerProductID, WarehouseSKU, Status, CreatedAt, CreatedBy)
              OUTPUT INSERTED.WarehouseProductID
              VALUES (@whId, @spId, @whSku, 'ACTIVE', SYSUTCDATETIME(), @userId)
            `);
          resolvedWpId = BigInt(insertWp.recordset[0].WarehouseProductID);
        }
      } else {
        throw new Error('Either warehouseProductId or both sellerProductId and warehouseId must be provided');
      }

      // 2. Fetch or create Inventory row for this shelf
      const invCheck = await transaction
        .request()
        .input('wpId', sql.BigInt, resolvedWpId)
        .query(`
          SELECT InventoryID, PhysicalQuantity, ReservedQuantity, DamagedQuantity, SafetyStockQuantity
          FROM dbo.Inventory
          WHERE WarehouseProductID = @wpId
        `);

      let inventoryId: bigint;
      let newPhysicalQty: number;

      if (invCheck.recordset.length === 0) {
        // Create initial shell with incoming quantity
        newPhysicalQty = data.quantity;
        const insertInv = await transaction
          .request()
          .input('wpId', sql.BigInt, resolvedWpId)
          .input('physQty', sql.Int, newPhysicalQty)
          .input('updatedBy', sql.BigInt, userId || null)
          .query(`
            INSERT INTO dbo.Inventory (
              WarehouseProductID, PhysicalQuantity, ReservedQuantity, DamagedQuantity, SafetyStockQuantity, UpdatedAt, UpdatedBy
            )
            OUTPUT INSERTED.InventoryID
            VALUES (
              @wpId, @physQty, 0, 0, 15, SYSUTCDATETIME(), @updatedBy
            )
          `);
        inventoryId = BigInt(insertInv.recordset[0].InventoryID);
      } else {
        inventoryId = BigInt(invCheck.recordset[0].InventoryID);
        newPhysicalQty = Number(invCheck.recordset[0].PhysicalQuantity) + data.quantity;

        await transaction
          .request()
          .input('invId', sql.BigInt, inventoryId)
          .input('newPhysQty', sql.Int, newPhysicalQty)
          .input('updatedBy', sql.BigInt, userId || null)
          .query(`
            UPDATE dbo.Inventory
            SET PhysicalQuantity = @newPhysQty,
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @updatedBy
            WHERE InventoryID = @invId
          `);
      }

      // 3. Insert audit ledger row into dbo.InventoryTransactions
      const insertTx = await transaction
        .request()
        .input('invId', sql.BigInt, inventoryId)
        .input('txType', sql.VarChar, 'INBOUND')
        .input('quantity', sql.Int, data.quantity) // signed positive for inflow
        .input('reason', sql.NVarChar, data.reason || 'Seller Inbound Shipment Notice')
        .input('poNumber', sql.NVarChar, data.poNumber || null)
        .input('poAmount', sql.Decimal(18, 2), data.poAmount || null)
        .input('poDocUrl', sql.NVarChar, data.poDocumentUrl || null)
        .input('grnNumber', sql.NVarChar, data.grnNumber || null)
        .input('grnAmount', sql.Decimal(18, 2), data.grnAmount || null)
        .input('grnDocUrl', sql.NVarChar, data.grnDocumentUrl || null)
        .input('supInvNum', sql.NVarChar, data.supplierInvoiceNumber || null)
        .input('invAmount', sql.Decimal(18, 2), data.invoiceAmount || null)
        .input('invDocUrl', sql.NVarChar, data.invoiceDocumentUrl || null)
        .input('createdBy', sql.BigInt, userId || null)
        .query(`
          INSERT INTO dbo.InventoryTransactions (
            InventoryID, OrderID, TransactionType, Quantity, Reason,
            PONumber, POAmount, PODocumentURL,
            GRNNumber, GRNAmount, GRNDocumentURL,
            SupplierInvoiceNumber, InvoiceAmount, InvoiceDocumentURL,
            CreatedAt, CreatedBy
          )
          OUTPUT INSERTED.InventoryTransactionID, INSERTED.CreatedAt
          VALUES (
            @invId, NULL, @txType, @quantity, @reason,
            @poNumber, @poAmount, @poDocUrl,
            @grnNumber, @grnAmount, @grnDocUrl,
            @supInvNum, @invAmount, @invDocUrl,
            SYSUTCDATETIME(), @createdBy
          )
        `);

      await transaction.commit();

      return {
        transactionId: String(insertTx.recordset[0].InventoryTransactionID),
        inventoryId: String(inventoryId),
        warehouseProductId: String(resolvedWpId),
        quantityAdded: data.quantity,
        newPhysicalQuantity: newPhysicalQty,
        createdAt: insertTx.recordset[0].CreatedAt,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Retrieves chronological audit ledger of all inventory transactions for this seller across all facilities.
   */
  async getStockLedger(
    sellerId: bigint | number,
    options: {
      warehouseId?: bigint | number;
      productId?: bigint | number;
      transactionType?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const pool = await getPool();
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        it.InventoryTransactionID,
        it.InventoryID,
        it.OrderID,
        it.TransactionType,
        it.Quantity,
        it.Reason,
        it.PONumber,
        it.POAmount,
        it.GRNNumber,
        it.GRNAmount,
        it.SupplierInvoiceNumber,
        it.InvoiceAmount,
        it.CreatedAt,
        w.WarehouseID,
        w.WarehouseName,
        w.WarehouseCode,
        sp.SellerProductID,
        sp.SellerSKU,
        pm.ProductID,
        pm.ProductName,
        pm.ProductName AS ProductTitle,
        COUNT(1) OVER() AS TotalCount
      FROM dbo.InventoryTransactions it
      JOIN dbo.Inventory inv ON it.InventoryID = inv.InventoryID
      JOIN dbo.WarehouseProducts wp ON inv.WarehouseProductID = wp.WarehouseProductID
      JOIN dbo.SellerProducts sp ON wp.SellerProductID = sp.SellerProductID
      JOIN dbo.Warehouses w ON wp.WarehouseID = w.WarehouseID
      JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
      JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
      WHERE sp.SellerID = @sellerId
    `;

    const request = pool.request().input('sellerId', sql.BigInt, sellerId);

    if (options.warehouseId) {
      request.input('warehouseId', sql.BigInt, options.warehouseId);
      query += ` AND w.WarehouseID = @warehouseId`;
    }

    if (options.productId) {
      request.input('productId', sql.BigInt, options.productId);
      query += ` AND pm.ProductID = @productId`;
    }

    if (options.transactionType) {
      request.input('txType', sql.VarChar, options.transactionType);
      query += ` AND it.TransactionType = @txType`;
    }

    query += `
      ORDER BY it.InventoryTransactionID DESC
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
        InventoryTransactionID: String(row.InventoryTransactionID),
        InventoryID: String(row.InventoryID),
        OrderID: row.OrderID ? String(row.OrderID) : null,
        WarehouseID: String(row.WarehouseID),
        SellerProductID: String(row.SellerProductID),
        ProductID: String(row.ProductID),
      })),
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * Retrieves all items currently triggering restock alerts (low stock or out of stock).
   */
  async getRestockAlerts(sellerId: bigint | number) {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('sellerId', sql.BigInt, sellerId)
      .query(`
        SELECT 
          wp.WarehouseProductID,
          wp.SellerProductID,
          wp.WarehouseID,
          w.WarehouseName,
          w.WarehouseCode,
          w.City AS WarehouseCity,
          sp.SellerSKU,
          sp.SellingPrice,
          pm.ProductID,
          pm.ProductName,
          pm.ProductName AS ProductTitle,
          ISNULL(i.PhysicalQuantity, 0) AS PhysicalQuantity,
          ISNULL(i.ReservedQuantity, 0) AS ReservedQuantity,
          ISNULL(i.DamagedQuantity, 0) AS DamagedQuantity,
          CASE WHEN ISNULL(i.SafetyStockQuantity, 0) > 0 THEN i.SafetyStockQuantity ELSE 15 END AS SafetyStockQuantity,
          (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) AS AvailableQuantity,
          CASE 
            WHEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= 0 THEN 'CRITICAL'
            ELSE 'WARNING'
          END AS AlertSeverity,
          CASE 
            WHEN (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= 0 
            THEN 'Out of Stock - Immediate replenishment recommended'
            ELSE 'Stock below safe operational threshold'
          END AS AlertMessage
        FROM dbo.SellerProducts sp
        JOIN dbo.WarehouseProducts wp ON sp.SellerProductID = wp.SellerProductID
        JOIN dbo.Warehouses w ON wp.WarehouseID = w.WarehouseID
        JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
        JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
        LEFT JOIN dbo.Inventory i ON wp.WarehouseProductID = i.WarehouseProductID
        WHERE sp.SellerID = @sellerId
          AND (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) <= CASE WHEN ISNULL(i.SafetyStockQuantity, 0) > 0 THEN i.SafetyStockQuantity ELSE 15 END
        ORDER BY (ISNULL(i.PhysicalQuantity, 0) - ISNULL(i.ReservedQuantity, 0) - ISNULL(i.DamagedQuantity, 0)) ASC;
      `);

    return result.recordset.map((row) => ({
      ...row,
      WarehouseProductID: String(row.WarehouseProductID),
      SellerProductID: String(row.SellerProductID),
      WarehouseID: String(row.WarehouseID),
      ProductID: String(row.ProductID),
    }));
  }

  /**
   * Updates safety stock threshold for a specific inventory shelf.
   */
  async updateSafetyStock(
    sellerId: bigint | number,
    inventoryId: bigint | number,
    safetyStockQuantity: number,
    userId?: bigint | number
  ) {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('invId', sql.BigInt, inventoryId)
      .input('sellerId', sql.BigInt, sellerId)
      .input('safetyStock', sql.Int, safetyStockQuantity)
      .input('updatedBy', sql.BigInt, userId || null)
      .query(`
        UPDATE i
        SET i.SafetyStockQuantity = @safetyStock,
            i.UpdatedAt = SYSUTCDATETIME(),
            i.UpdatedBy = @updatedBy
        OUTPUT INSERTED.InventoryID, INSERTED.SafetyStockQuantity
        FROM dbo.Inventory i
        JOIN dbo.WarehouseProducts wp ON i.WarehouseProductID = wp.WarehouseProductID
        JOIN dbo.SellerProducts sp ON wp.SellerProductID = sp.SellerProductID
        WHERE i.InventoryID = @invId AND sp.SellerID = @sellerId;
      `);

    if (result.recordset.length === 0) {
      throw new Error('Inventory shelf not found or access denied');
    }

    return result.recordset[0];
  }
}

export const inventoryRepository = new InventoryRepository();

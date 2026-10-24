import { getPool, sql } from '../../database/db.js';

export interface RawCatalogProduct {
  ProductID: string | bigint;
  ParentSKU: string;
  ProductName: string;
  Description: string | null;
  Highlights: string | null;
  BaseModelCode: string | null;
  HSNCode: string | null;
  GSTRate: number | null;
  CountryOfOrigin: string | null;
  BrandID: string | bigint | null;
  BrandName: string | null;
  BrandCode: string | null;
  CategoriesJson: string | null;
  VariantsJson: string | null;
}

export interface RawSellerProductListing {
  SellerProductID: string | bigint;
  SellerSKU: string | null;
  MRP: number | string;
  SellingPrice: number | string;
  PurchasePrice: number | string;
  PackerName?: string | null;
  ImporterName?: string | null;
  Status: string;
  CreatedAt: Date;
  ProductID: string | bigint;
  ParentSKU: string;
  ProductName: string;
  BrandName: string | null;
  CategoryName: string | null;
  VariantSKU: string;
  GTIN: string | null;
  AssetsJson: string | null;
  AttributesJson: string | null;
  WarehousesJson: string | null;
}

export interface RawQCQueueItem {
  ProductID: string | bigint;
  ParentSKU: string;
  ProductName: string;
  Description: string | null;
  Highlights: string | null;
  BaseModelCode: string | null;
  HSNCode: string | null;
  GSTRate: number | null;
  CountryOfOrigin: string | null;
  Status: string;
  IsVerified: boolean;
  CreatedAt: Date;
  BrandID: string | bigint | null;
  BrandName: string | null;
  BrandCode: string | null;
  CategoryID: string | bigint | null;
  CategoryName: string | null;
  CategoryCode: string | null;
  CreatorUserID: string | bigint | null;
  CreatorFirstName: string | null;
  CreatorLastName: string | null;
  CreatorEmail: string | null;
  VariantsJson: string | null;
}

export class ProductsRepository {
  /**
   * Find category by ID along with its sub-category count.
   */
  async findCategoryWithChildrenCount(categoryId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('categoryId', sql.BigInt, categoryId)
      .query<{
        CategoryID: string | bigint;
        CategoryName: string;
        CategoryCode: string;
        Status: string;
        ChildCount: number;
      }>(`
        SELECT 
          c.CategoryID,
          c.CategoryName,
          c.CategoryCode,
          c.Status,
          (SELECT COUNT(*) FROM dbo.Categories sub WHERE sub.ParentCategoryID = c.CategoryID) AS ChildCount
        FROM dbo.Categories c
        WHERE c.CategoryID = @categoryId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Find brand by ID.
   */
  async findBrandById(brandId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('brandId', sql.BigInt, brandId)
      .query<{
        BrandID: string | bigint;
        BrandName: string;
        BrandCode: string;
        Status: string;
      }>(`
        SELECT BrandID, BrandName, BrandCode, Status
        FROM dbo.Brands
        WHERE BrandID = @brandId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Search approved catalog for seller listing flow.
   */
  async searchApprovedCatalog(
    sellerId: bigint,
    params: {
      brandId?: bigint;
      categoryId?: bigint;
      q?: string;
      page: number;
      limit: number;
    }
  ): Promise<{ total: number; products: RawCatalogProduct[] }> {
    const pool = await getPool();
    const request = pool.request();

    const conditions: string[] = ["pm.Status IN ('APPROVED', 'ACTIVE')"];

    if (params.brandId) {
      conditions.push('pm.BrandID = @brandId');
      request.input('brandId', sql.BigInt, params.brandId);
    }

    if (params.categoryId) {
      conditions.push('EXISTS (SELECT 1 FROM dbo.ProductCategories pc WHERE pc.ProductID = pm.ProductID AND pc.CategoryID = @categoryId)');
      request.input('categoryId', sql.BigInt, params.categoryId);
    }

    if (params.q) {
      const q = params.q.trim();
      conditions.push(`(
        pm.ProductName LIKE @q
        OR pm.ParentSKU LIKE @q
        OR pm.Description LIKE @q
        OR b.BrandName LIKE @q
        OR EXISTS (
          SELECT 1 FROM dbo.ProductVariants pv 
          WHERE pv.ProductMasterID = pm.ProductID 
            AND (pv.GTIN LIKE @q OR pv.VariantModelCode LIKE @q OR pv.VariantSKU LIKE @q)
        )
      )`);
      request.input('q', sql.NVarChar(255), `%${q}%`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total count
    const countResult = await request.query<{ Total: number }>(`
      SELECT COUNT(*) AS Total
      FROM dbo.ProductMaster pm
      LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
      ${whereClause}
    `);
    const total = countResult.recordset[0]?.Total || 0;

    // Paged items
    const skip = (params.page - 1) * params.limit;
    request.input('skip', sql.Int, skip);
    request.input('limit', sql.Int, params.limit);
    request.input('sellerId', sql.BigInt, sellerId);

    const itemsResult = await request.query<RawCatalogProduct>(`
      SELECT 
        pm.ProductID,
        pm.ParentSKU,
        pm.ProductName,
        pm.Description,
        pm.Highlights,
        pm.BaseModelCode,
        pm.HSNCode,
        pm.GSTRate,
        pm.CountryOfOrigin,
        b.BrandID,
        b.BrandName,
        b.BrandCode,
        (
          SELECT c.CategoryID, c.CategoryName, c.CategoryCode
          FROM dbo.ProductCategories pc
          JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID
          WHERE pc.ProductID = pm.ProductID
          FOR JSON PATH
        ) AS CategoriesJson,
        (
          SELECT 
            pv.ProductVariantID,
            pv.VariantSKU,
            pv.GTIN,
            pv.VariantModelCode,
            (
              SELECT pa.AssetURL, pa.IsPrimary
              FROM dbo.ProductAssets pa
              WHERE pa.ProductVariantID = pv.ProductVariantID AND pa.Status = 'ACTIVE'
              ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
              FOR JSON PATH
            ) AS AssetsJson,
            (
              SELECT pva.AttributeID, a.AttributeName, pva.AttributeValueID, pva.AttributeValue, av.ValueName
              FROM dbo.ProductVariantAttributes pva
              JOIN dbo.Attributes a ON pva.AttributeID = a.AttributeID
              LEFT JOIN dbo.AttributeValues av ON pva.AttributeValueID = av.AttributeValueID
              WHERE pva.ProductVariantID = pv.ProductVariantID
              FOR JSON PATH
            ) AS AttributesJson,
            (
              SELECT sp.SellerProductID, sp.Status
              FROM dbo.SellerProducts sp
              WHERE sp.ProductVariantID = pv.ProductVariantID AND sp.SellerID = @sellerId
              FOR JSON PATH
            ) AS SellerProductsJson
          FROM dbo.ProductVariants pv
          WHERE pv.ProductMasterID = pm.ProductID AND pv.Status = 'ACTIVE'
          FOR JSON PATH
        ) AS VariantsJson
      FROM dbo.ProductMaster pm
      LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
      ${whereClause}
      ORDER BY pm.CreatedAt DESC
      OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return {
      total,
      products: itemsResult.recordset,
    };
  }

  /**
   * Get applications for a seller.
   */
  async findSellerApplications(sellerId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<{ CategoryID: string | bigint; Status: string }>(`
        SELECT CategoryID, Status
        FROM dbo.SellerApplications
        WHERE SellerID = @sellerId
      `);

    return result.recordset;
  }

  /**
   * Check if seller has approved application for any of the given category IDs,
   * or already has active listings in that category, or the category is ungated.
   */
  async hasApprovedCategoryApplication(sellerId: bigint, categoryIds: bigint[]): Promise<boolean> {
    if (categoryIds.length === 0) return false;
    const pool = await getPool();
    const request = pool.request();
    request.input('sellerId', sql.BigInt, sellerId);

    const idParams = categoryIds.map((id, index) => {
      const pName = `catId_${index}`;
      request.input(pName, sql.BigInt, id);
      return `@${pName}`;
    });

    const result = await request.query<{ Found: number }>(`
      -- 1. Check SellerApplications (Approved)
      SELECT TOP 1 1 AS Found
      FROM dbo.SellerApplications
      WHERE SellerID = @sellerId
        AND CategoryID IN (${idParams.join(', ')})
        AND Status = 'APPROVED'

      UNION ALL

      -- 2. Check existing active seller products in this category
      SELECT TOP 1 1 AS Found
      FROM dbo.SellerProducts sp
      JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
      JOIN dbo.ProductCategories pc ON pv.ProductMasterID = pc.ProductID
      WHERE sp.SellerID = @sellerId
        AND sp.Status = 'ACTIVE'
        AND pc.CategoryID IN (${idParams.join(', ')})

      UNION ALL

      -- 3. Check if category is ungated (no mandatory documents required)
      SELECT TOP 1 1 AS Found
      FROM dbo.Categories c
      WHERE c.CategoryID IN (${idParams.join(', ')})
        AND NOT EXISTS (
          SELECT 1 FROM dbo.CategoryDocuments cd 
          WHERE cd.CategoryID = c.CategoryID AND cd.Status = 'ACTIVE' AND cd.IsMandatory = 1
        )
    `);

    return (result.recordset.length > 0);
  }

  /**
   * Find product variant details needed for seller listing.
   */
  async findVariantForListing(variantId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('variantId', sql.BigInt, variantId)
      .query<{
        ProductVariantID: string | bigint;
        VariantSKU?: string;
        ProductMasterID: string | bigint;
        VariantStatus: string;
        ProductMasterStatus: string;
        CategoryID: string | bigint | null;
        CategoryName: string | null;
      }>(`
        SELECT 
          pv.ProductVariantID,
          pv.VariantSKU,
          pv.ProductMasterID,
          pv.Status AS VariantStatus,
          pm.Status AS ProductMasterStatus,
          c.CategoryID,
          c.CategoryName
        FROM dbo.ProductVariants pv
        JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
        LEFT JOIN dbo.ProductCategories pc ON pm.ProductID = pc.ProductID
        LEFT JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID
        WHERE pv.ProductVariantID = @variantId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Find existing listing by seller and variant.
   */
  async findListingBySellerAndVariant(sellerId: bigint, variantId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .input('variantId', sql.BigInt, variantId)
      .query<{ SellerProductID: string | bigint }>(`
        SELECT TOP 1 SellerProductID
        FROM dbo.SellerProducts
        WHERE SellerID = @sellerId AND ProductVariantID = @variantId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Find existing listing by seller and sellerSku.
   */
  async findListingBySellerAndSku(sellerId: bigint, sellerSku: string) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .input('sellerSku', sql.NVarChar(100), sellerSku)
      .query<{ SellerProductID: string | bigint }>(`
        SELECT TOP 1 SellerProductID
        FROM dbo.SellerProducts
        WHERE SellerID = @sellerId AND SellerSKU = @sellerSku
      `);

    return result.recordset[0] || null;
  }

  /**
   * Create commercial listing for a seller product variant.
   */
  async createSellerProduct(
    data: {
      sellerId: bigint;
      variantId: bigint;
      sellerSku: string;
      mrp: number;
      sellingPrice: number;
      purchasePrice: number;
      packerName?: string | null;
      importerName?: string | null;
      userId: bigint;
    },
    tx?: sql.Transaction
  ) {
    const pool = await getPool();
    const req = tx ? new sql.Request(tx) : pool.request();
    const result = await req
      .input('sellerId', sql.BigInt, data.sellerId)
      .input('variantId', sql.BigInt, data.variantId)
      .input('sellerSku', sql.NVarChar(100), data.sellerSku)
      .input('mrp', sql.Decimal(18, 2), data.mrp)
      .input('sellingPrice', sql.Decimal(18, 2), data.sellingPrice)
      .input('purchasePrice', sql.Decimal(18, 2), data.purchasePrice)
      .input('packerName', sql.NVarChar(255), data.packerName || null)
      .input('importerName', sql.NVarChar(255), data.importerName || null)
      .input('userId', sql.BigInt, data.userId)
      .query<{
        SellerProductID: string | bigint;
        SellerSKU: string;
        MRP: number;
        SellingPrice: number;
        PurchasePrice: number;
        PackerName: string | null;
        ImporterName: string | null;
        Status: string;
      }>(`
        INSERT INTO dbo.SellerProducts (
          SellerID, ProductVariantID, SellerSKU, MRP, SellingPrice, PurchasePrice, PackerName, ImporterName, Status, CreatedBy, CreatedAt
        )
        OUTPUT 
          INSERTED.SellerProductID,
          INSERTED.SellerSKU,
          INSERTED.MRP,
          INSERTED.SellingPrice,
          INSERTED.PurchasePrice,
          INSERTED.PackerName,
          INSERTED.ImporterName,
          INSERTED.Status
        VALUES (
          @sellerId, @variantId, @sellerSku, @mrp, @sellingPrice, @purchasePrice, @packerName, @importerName, 'ACTIVE', @userId, GETDATE()
        )
      `);

    return result.recordset[0];
  }

  /**
   * Find a SellerProduct by ID, scoped to a seller for authorization.
   */
  async findSellerProductBySeller(sellerProductId: bigint, sellerId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerProductId', sql.BigInt, sellerProductId)
      .input('sellerId', sql.BigInt, sellerId)
      .query<{ SellerProductID: string | bigint; SellerSKU: string | null; Status: string; ProductVariantID: string | bigint }>(`
        SELECT TOP 1 SellerProductID, SellerSKU, Status, ProductVariantID
        FROM dbo.SellerProducts
        WHERE SellerProductID = @sellerProductId AND SellerID = @sellerId
      `);
    return result.recordset[0] || null;
  }

  /**
   * Check if a SellerProduct is already assigned to a given warehouse.
   */
  async findWarehouseProductBySellerProduct(sellerProductId: bigint, warehouseId: bigint, tx?: sql.Transaction) {
    const pool = await getPool();
    const req = tx ? new sql.Request(tx) : pool.request();
    const result = await req
      .input('sellerProductId', sql.BigInt, sellerProductId)
      .input('warehouseId', sql.BigInt, warehouseId)
      .query<{ WarehouseProductID: string | bigint }>(`
        SELECT TOP 1 WarehouseProductID
        FROM dbo.WarehouseProducts
        WHERE SellerProductID = @sellerProductId AND WarehouseID = @warehouseId
      `);
    return result.recordset[0] || null;
  }

  /**
   * Create a WarehouseProduct row linking a SellerProduct to a Warehouse.
   */
  async createWarehouseProduct(
    data: {
      warehouseId: bigint;
      sellerProductId: bigint;
      warehouseSku?: string | null;
      userId: bigint;
    },
    tx?: sql.Transaction
  ) {
    const pool = await getPool();
    const req = tx ? new sql.Request(tx) : pool.request();
    const result = await req
      .input('warehouseId', sql.BigInt, data.warehouseId)
      .input('sellerProductId', sql.BigInt, data.sellerProductId)
      .input('warehouseSku', sql.NVarChar(100), data.warehouseSku || null)
      .input('userId', sql.BigInt, data.userId)
      .query<{ WarehouseProductID: string | bigint }>(`
        INSERT INTO dbo.WarehouseProducts (
          WarehouseID, SellerProductID, WarehouseSKU, Status, CreatedBy, CreatedAt
        )
        OUTPUT INSERTED.WarehouseProductID
        VALUES (
          @warehouseId, @sellerProductId, @warehouseSku, 'ACTIVE', @userId, GETDATE()
        )
      `);
    return result.recordset[0];
  }

  /**
   * Create the Inventory shell row for a newly created WarehouseProduct.
   * Can initialize with 0 or opening stock quantity.
   */
  async createInventoryShell(
    data: {
      warehouseProductId: bigint;
      initialQty?: number;
      userId: bigint;
    },
    tx?: sql.Transaction
  ) {
    const pool = await getPool();
    const req = tx ? new sql.Request(tx) : pool.request();
    const initialQty = Math.max(0, data.initialQty || 0);
    const result = await req
      .input('warehouseProductId', sql.BigInt, data.warehouseProductId)
      .input('initialQty', sql.Int, initialQty)
      .input('userId', sql.BigInt, data.userId)
      .query<{ InventoryID: string | bigint; PhysicalQuantity: number }>(`
        INSERT INTO dbo.Inventory (
          WarehouseProductID, PhysicalQuantity, ReservedQuantity, DamagedQuantity, SafetyStockQuantity, UpdatedAt, UpdatedBy
        )
        OUTPUT INSERTED.InventoryID, INSERTED.PhysicalQuantity
        VALUES (
          @warehouseProductId, @initialQty, 0, 0, 15, GETDATE(), @userId
        )
      `);
    return result.recordset[0];
  }

  /**
   * Create an InventoryTransaction audit ledger row.
   * Uses signed quantities (+ for inbound/opening, - for outbound/damage, 0 for initial baseline).
   */
  async createInventoryTransaction(
    data: {
      inventoryId: bigint;
      orderId?: bigint | null;
      transactionType: string;
      quantity: number;
      reason?: string | null;
      poNumber?: string | null;
      poAmount?: number | null;
      grnNumber?: string | null;
      supplierInvoiceNumber?: string | null;
      invoiceAmount?: number | null;
      userId: bigint;
    },
    tx?: sql.Transaction
  ) {
    const pool = await getPool();
    const req = tx ? new sql.Request(tx) : pool.request();
    const result = await req
      .input('inventoryId', sql.BigInt, data.inventoryId)
      .input('orderId', sql.BigInt, data.orderId || null)
      .input('transactionType', sql.VarChar(30), data.transactionType)
      .input('quantity', sql.Int, data.quantity)
      .input('reason', sql.NVarChar(500), data.reason || null)
      .input('poNumber', sql.NVarChar(100), data.poNumber || null)
      .input('poAmount', sql.Decimal(18, 2), data.poAmount ?? null)
      .input('grnNumber', sql.NVarChar(100), data.grnNumber || null)
      .input('supplierInvoiceNumber', sql.NVarChar(100), data.supplierInvoiceNumber || null)
      .input('invoiceAmount', sql.Decimal(18, 2), data.invoiceAmount ?? null)
      .input('userId', sql.BigInt, data.userId)
      .query<{ InventoryTransactionID: string | bigint }>(`
        INSERT INTO dbo.InventoryTransactions (
          InventoryID, OrderID, TransactionType, Quantity, Reason,
          PONumber, POAmount, GRNNumber, SupplierInvoiceNumber, InvoiceAmount,
          CreatedAt, CreatedBy
        )
        OUTPUT INSERTED.InventoryTransactionID
        VALUES (
          @inventoryId, @orderId, @transactionType, @quantity, @reason,
          @poNumber, @poAmount, @grnNumber, @supplierInvoiceNumber, @invoiceAmount,
          GETDATE(), @userId
        )
      `);
    return result.recordset[0];
  }

  /**
   * Find attribute value by ID.
   */
  async findAttributeValueById(attributeValueId: bigint, tx?: sql.Transaction) {
    const pool = await getPool();
    const req = tx ? new sql.Request(tx) : pool.request();
    const result = await req
      .input('valId', sql.BigInt, attributeValueId)
      .query<{ AttributeValueID: string | bigint; ValueCode: string; ValueName: string }>(`
        SELECT AttributeValueID, ValueCode, ValueName
        FROM dbo.AttributeValues
        WHERE AttributeValueID = @valId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Insert new ProductMaster (Seller proposal flow, defaults to Status='PENDING_QC', IsVerified=0).
   */
  async insertProductMaster(
    data: {
      parentSku: string;
      brandId: bigint;
      productName: string;
      description?: string;
      highlights?: string | null;
      baseModelCode?: string | null;
      hsnCode?: string | null;
      gstRate?: number | null;
      countryOfOrigin?: string | null;
      userId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    const result = await req
      .input('parentSku', sql.NVarChar(100), data.parentSku)
      .input('brandId', sql.BigInt, data.brandId)
      .input('productName', sql.NVarChar(255), data.productName)
      .input('description', sql.NVarChar(sql.MAX), data.description || null)
      .input('highlights', sql.NVarChar(sql.MAX), data.highlights || null)
      .input('baseModelCode', sql.NVarChar(100), data.baseModelCode || null)
      .input('hsnCode', sql.NVarChar(20), data.hsnCode || null)
      .input('gstRate', sql.Decimal(5, 2), data.gstRate ?? null)
      .input('countryOfOrigin', sql.VarChar(100), data.countryOfOrigin || 'India')
      .input('userId', sql.BigInt, data.userId)
      .query<{ ProductID: string | bigint; ParentSKU: string; ProductName: string; Status: string }>(`
        INSERT INTO dbo.ProductMaster (
          ParentSKU, BrandID, ProductName, Description, Highlights,
          BaseModelCode, HSNCode, GSTRate, CountryOfOrigin,
          IsVerified, Status, CreatedBy, CreatedAt
        )
        OUTPUT INSERTED.ProductID, INSERTED.ParentSKU, INSERTED.ProductName, INSERTED.Status
        VALUES (
          @parentSku, @brandId, @productName, @description, @highlights,
          @baseModelCode, @hsnCode, @gstRate, @countryOfOrigin,
          0, 'PENDING_QC', @userId, GETDATE()
        )
      `);

    return result.recordset[0];
  }

  /**
   * Admin-specific direct insert of ProductMaster.
   * Directly sets IsVerified = 1 and status to 'ACTIVE' or 'DRAFT'.
   */
  async insertProductMasterAdmin(
    data: {
      parentSku: string;
      brandId: bigint;
      productName: string;
      description?: string;
      highlights?: string | null;
      baseModelCode?: string | null;
      hsnCode?: string | null;
      gstRate?: number | null;
      countryOfOrigin?: string | null;
      status: 'ACTIVE' | 'DRAFT' | 'PENDING_QC';
      userId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    const result = await req
      .input('parentSku', sql.NVarChar(100), data.parentSku)
      .input('brandId', sql.BigInt, data.brandId)
      .input('productName', sql.NVarChar(255), data.productName)
      .input('description', sql.NVarChar(sql.MAX), data.description || null)
      .input('highlights', sql.NVarChar(sql.MAX), data.highlights || null)
      .input('baseModelCode', sql.NVarChar(100), data.baseModelCode || null)
      .input('hsnCode', sql.NVarChar(20), data.hsnCode || null)
      .input('gstRate', sql.Decimal(5, 2), data.gstRate ?? null)
      .input('countryOfOrigin', sql.VarChar(100), data.countryOfOrigin || 'India')
      .input('status', sql.VarChar(20), data.status)
      .input('userId', sql.BigInt, data.userId)
      .query<{ ProductID: string | bigint; ParentSKU: string; ProductName: string; Status: string }>(`
        INSERT INTO dbo.ProductMaster (
          ParentSKU, BrandID, ProductName, Description, Highlights,
          BaseModelCode, HSNCode, GSTRate, CountryOfOrigin,
          IsVerified, Status, CreatedBy, CreatedAt
        )
        OUTPUT INSERTED.ProductID, INSERTED.ParentSKU, INSERTED.ProductName, INSERTED.Status
        VALUES (
          @parentSku, @brandId, @productName, @description, @highlights,
          @baseModelCode, @hsnCode, @gstRate, @countryOfOrigin,
          CASE WHEN @status IN ('ACTIVE', 'APPROVED') THEN 1 ELSE 0 END, @status, @userId, GETDATE()
        )
      `);

    return result.recordset[0];
  }

  /**
   * Link product to category.
   */
  async insertProductCategory(productId: bigint, categoryId: bigint, userId: bigint, tx: sql.Transaction) {
    const req = new sql.Request(tx);
    await req
      .input('productId', sql.BigInt, productId)
      .input('categoryId', sql.BigInt, categoryId)
      .input('userId', sql.BigInt, userId)
      .query(`
        INSERT INTO dbo.ProductCategories (ProductID, CategoryID, CreatedBy, CreatedAt)
        VALUES (@productId, @categoryId, @userId, GETDATE())
      `);
  }

  /**
   * Insert product variant.
   */
  async insertProductVariant(
    data: {
      productMasterId: bigint;
      variantSku: string;
      gtin?: string | null;
      variantModelCode?: string | null; // renamed from productModelCode; HSNCode/GSTRate moved to ProductMaster
      length?: number | null;
      width?: number | null;
      height?: number | null;
      weight?: number | null;
      netWeight?: number | null;
      grossWeight?: number | null;
      shippingWeight?: number | null;
      status?: string;
      userId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    const resolvedNetWeight = data.netWeight ?? data.weight ?? null;
    const resolvedGrossWeight = data.grossWeight ?? resolvedNetWeight ?? null;
    const resolvedShippingWeight = data.shippingWeight ?? resolvedGrossWeight ?? null;

    const result = await req
      .input('productMasterId', sql.BigInt, data.productMasterId)
      .input('variantSku', sql.NVarChar(100), data.variantSku)
      .input('gtin', sql.NVarChar(50), data.gtin || null)
      .input('variantModelCode', sql.NVarChar(100), data.variantModelCode || null)
      .input('length', sql.Decimal(12, 3), data.length ?? null)
      .input('width', sql.Decimal(12, 3), data.width ?? null)
      .input('height', sql.Decimal(12, 3), data.height ?? null)
      .input('netWeight', sql.Decimal(12, 3), resolvedNetWeight)
      .input('grossWeight', sql.Decimal(12, 3), resolvedGrossWeight)
      .input('shippingWeight', sql.Decimal(12, 3), resolvedShippingWeight)
      .input('status', sql.VarChar(20), data.status || 'PENDING_QC')
      .input('userId', sql.BigInt, data.userId)
      .query<{ ProductVariantID: string | bigint; VariantSKU: string; Status: string }>(`
        INSERT INTO dbo.ProductVariants (
          ProductMasterID, VariantSKU, GTIN, VariantModelCode,
          Length, Width, Height, NetWeight, GrossWeight, ShippingWeight, Status, CreatedBy, CreatedAt
        )
        OUTPUT INSERTED.ProductVariantID, INSERTED.VariantSKU, INSERTED.Status
        VALUES (
          @productMasterId, @variantSku, @gtin, @variantModelCode,
          @length, @width, @height, @netWeight, @grossWeight, @shippingWeight, @status, @userId, GETDATE()
        )
      `);

    return result.recordset[0];
  }

  /**
   * Insert product variant attribute.
   */
  async insertProductVariantAttribute(
    data: {
      variantId: bigint;
      attributeId: bigint;
      attributeValueId?: bigint | null;
      attributeValue: string;
      userId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    await req
      .input('variantId', sql.BigInt, data.variantId)
      .input('attributeId', sql.BigInt, data.attributeId)
      .input('attributeValueId', sql.BigInt, data.attributeValueId || null)
      .input('attributeValue', sql.NVarChar(255), data.attributeValue)
      .input('userId', sql.BigInt, data.userId)
      .query(`
        INSERT INTO dbo.ProductVariantAttributes (
          ProductVariantID, AttributeID, AttributeValueID, AttributeValue, CreatedBy, CreatedAt
        )
        VALUES (
          @variantId, @attributeId, @attributeValueId, @attributeValue, @userId, GETDATE()
        )
      `);
  }

  /**
   * Insert product variant UOM.
   */
  async insertProductVariantUOM(
    data: {
      variantId: bigint;
      uomId: bigint;
      quantity: number;
      userId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    await req
      .input('variantId', sql.BigInt, data.variantId)
      .input('uomId', sql.BigInt, data.uomId)
      .input('quantity', sql.Decimal(18, 3), data.quantity)
      .input('userId', sql.BigInt, data.userId)
      .query(`
        INSERT INTO dbo.ProductVariantUOMs (
          ProductVariantID, UOMID, Quantity, Status, CreatedBy, CreatedAt
        )
        VALUES (
          @variantId, @uomId, @quantity, 'ACTIVE', @userId, GETDATE()
        )
      `);
  }

  /**
   * Insert product asset.
   */
  async insertProductAsset(
    data: {
      variantId: bigint;
      assetType: string;
      assetUrl: string;
      isPrimary: boolean;
      altText?: string | null;
      displayOrder: number;
      userId: bigint;
    },
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    await req
      .input('variantId', sql.BigInt, data.variantId)
      .input('assetType', sql.VarChar(30), data.assetType)
      .input('assetUrl', sql.NVarChar(sql.MAX), data.assetUrl)
      .input('isPrimary', sql.Bit, data.isPrimary ? 1 : 0)
      .input('altText', sql.NVarChar(500), data.altText || null)
      .input('displayOrder', sql.Int, data.displayOrder)
      .input('userId', sql.BigInt, data.userId)
      .query(`
        INSERT INTO dbo.ProductAssets (
          ProductVariantID, AssetType, AssetURL, IsPrimary, AltText, DisplayOrder, Status, CreatedBy, CreatedAt
        )
        VALUES (
          @variantId, @assetType, @assetUrl, @isPrimary, @altText, @displayOrder, 'ACTIVE', @userId, GETDATE()
        )
      `);
  }

  /**
   * Get proposals submitted by a specific user.
   */
  async findSellerProposals(userId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.BigInt, userId)
      .query<{
        ProductID: string | bigint;
        ParentSKU: string;
        ProductName: string;
        Description: string | null;
        Highlights: string | null;
        BrandName: string | null;
        CategoryName: string | null;
        Status: string;
        IsVerified: boolean;
        CreatedAt: Date;
        VariantsJson: string | null;
      }>(`
        SELECT 
          pm.ProductID,
          pm.ParentSKU,
          pm.ProductName,
          pm.Description,
          pm.Highlights,
          b.BrandName,
          c.CategoryName,
          pm.Status,
          pm.IsVerified,
          pm.CreatedAt,
          (
            SELECT 
              pv.ProductVariantID,
              pv.VariantSKU,
              (
                SELECT pa.AssetURL, pa.IsPrimary
                FROM dbo.ProductAssets pa
                WHERE pa.ProductVariantID = pv.ProductVariantID AND pa.Status = 'ACTIVE'
                ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
                FOR JSON PATH
              ) AS AssetsJson,
              (
                SELECT a.AttributeName, pva.AttributeValue, av.ValueName
                FROM dbo.ProductVariantAttributes pva
                JOIN dbo.Attributes a ON pva.AttributeID = a.AttributeID
                LEFT JOIN dbo.AttributeValues av ON pva.AttributeValueID = av.AttributeValueID
                WHERE pva.ProductVariantID = pv.ProductVariantID
                FOR JSON PATH
              ) AS AttributesJson
            FROM dbo.ProductVariants pv
            WHERE pv.ProductMasterID = pm.ProductID
            FOR JSON PATH
          ) AS VariantsJson
        FROM dbo.ProductMaster pm
        LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
        LEFT JOIN dbo.ProductCategories pc ON pm.ProductID = pc.ProductID
        LEFT JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID
        WHERE pm.CreatedBy = @userId
        ORDER BY pm.CreatedAt DESC
      `);

    return result.recordset;
  }

  /**
   * Get admin QC queue with total count and items.
   */
  async findAdminQCQueue(params: {
    status?: string;
    q?: string;
    page: number;
    limit: number;
  }): Promise<{
    total: number;
    items: RawQCQueueItem[];
    counts: { pendingQC: number; approved: number; reworkRequired: number; rejected: number };
  }> {
    const pool = await getPool();
    const request = pool.request();

    const conditions: string[] = [];

    if (params.status && params.status !== 'ALL') {
      conditions.push('pm.Status = @status');
      request.input('status', sql.VarChar(20), params.status);
    } else if (!params.status) {
      conditions.push("pm.Status = 'PENDING_QC'");
    }

    if (params.q) {
      const q = params.q.trim();
      conditions.push(`(
        pm.ProductName LIKE @q
        OR pm.ParentSKU LIKE @q
        OR b.BrandName LIKE @q
        OR EXISTS (
          SELECT 1 FROM dbo.ProductVariants pv 
          WHERE pv.ProductMasterID = pm.ProductID 
            AND (pv.VariantSKU LIKE @q OR pv.GTIN = @exactQ OR pv.VariantModelCode LIKE @q)
        )
        OR EXISTS (
          SELECT 1 FROM dbo.ProductCategories pc 
          JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID 
          WHERE pc.ProductID = pm.ProductID AND c.CategoryName LIKE @q
        )
      )`);
      request.input('q', sql.NVarChar(255), `%${q}%`);
      request.input('exactQ', sql.NVarChar(100), q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count
    const countResult = await request.query<{ Total: number }>(`
      SELECT COUNT(*) AS Total
      FROM dbo.ProductMaster pm
      LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
      ${whereClause}
    `);
    const total = countResult.recordset[0]?.Total || 0;

    // Overall status counts across all proposals (for read-only stats overview)
    const statsResult = await pool.request().query<{
      PendingQC: number;
      Approved: number;
      ReworkRequired: number;
      Rejected: number;
    }>(`
      SELECT 
        COUNT(CASE WHEN pm.Status = 'PENDING_QC' THEN 1 END) AS PendingQC,
        COUNT(CASE WHEN pm.Status = 'APPROVED' THEN 1 END) AS Approved,
        COUNT(CASE WHEN pm.Status = 'REWORK_REQUIRED' THEN 1 END) AS ReworkRequired,
        COUNT(CASE WHEN pm.Status = 'REJECTED' THEN 1 END) AS Rejected
      FROM dbo.ProductMaster pm
    `);
    const countsRow = statsResult.recordset[0];
    const counts = {
      pendingQC: countsRow?.PendingQC || 0,
      approved: countsRow?.Approved || 0,
      reworkRequired: countsRow?.ReworkRequired || 0,
      rejected: countsRow?.Rejected || 0,
    };

    const skip = (params.page - 1) * params.limit;
    request.input('skip', sql.Int, skip);
    request.input('limit', sql.Int, params.limit);

    const itemsResult = await request.query<RawQCQueueItem>(`
      SELECT 
        pm.ProductID,
        pm.ParentSKU,
        pm.ProductName,
        pm.Description,
        pm.Highlights,
        pm.BaseModelCode,
        pm.HSNCode,
        pm.GSTRate,
        pm.CountryOfOrigin,
        pm.Status,
        pm.IsVerified,
        pm.CreatedAt,
        b.BrandID,
        b.BrandName,
        b.BrandCode,
        c.CategoryID,
        c.CategoryName,
        c.CategoryCode,
        u.UserID AS CreatorUserID,
        u.FirstName AS CreatorFirstName,
        u.LastName AS CreatorLastName,
        u.Email AS CreatorEmail,
        (
          SELECT 
            pv.ProductVariantID,
            pv.VariantSKU,
            pv.GTIN,
            pv.VariantModelCode,
            pv.Length,
            pv.Width,
            pv.Height,
            pv.NetWeight,
            pv.GrossWeight,
            pv.ShippingWeight,
            (
              SELECT pa.ProductAssetID, pa.AssetURL, pa.IsPrimary, pa.AltText
              FROM dbo.ProductAssets pa
              WHERE pa.ProductVariantID = pv.ProductVariantID
              ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
              FOR JSON PATH
            ) AS AssetsJson,
            (
              SELECT pva.AttributeID, a.AttributeName, pva.AttributeValue, av.ValueName
              FROM dbo.ProductVariantAttributes pva
              JOIN dbo.Attributes a ON pva.AttributeID = a.AttributeID
              LEFT JOIN dbo.AttributeValues av ON pva.AttributeValueID = av.AttributeValueID
              WHERE pva.ProductVariantID = pv.ProductVariantID
              FOR JSON PATH
            ) AS AttributesJson,
            (
              SELECT uom.UOMCode, uom.UOMName, pvu.Quantity
              FROM dbo.ProductVariantUOMs pvu
              JOIN dbo.UOM uom ON pvu.UOMID = uom.UOMID
              WHERE pvu.ProductVariantID = pv.ProductVariantID
              FOR JSON PATH
            ) AS UOMsJson
          FROM dbo.ProductVariants pv
          WHERE pv.ProductMasterID = pm.ProductID
          FOR JSON PATH
        ) AS VariantsJson
      FROM dbo.ProductMaster pm
      LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
      LEFT JOIN dbo.ProductCategories pc ON pm.ProductID = pc.ProductID
      LEFT JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID
      LEFT JOIN dbo.Users u ON pm.CreatedBy = u.UserID
      ${whereClause}
      ORDER BY pm.CreatedAt DESC
      OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return {
      total,
      items: itemsResult.recordset,
      counts,
    };
  }

  /**
   * Find product master by ID for QC review.
   */
  async findProductMasterById(productId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('productId', sql.BigInt, productId)
      .query<{ ProductID: string | bigint; ParentSKU: string; Status: string; CategoryID: string | bigint | null }>(`
        SELECT 
          pm.ProductID, 
          pm.ParentSKU, 
          pm.Status, 
          pc.CategoryID
        FROM dbo.ProductMaster pm
        LEFT JOIN dbo.ProductCategories pc ON pm.ProductID = pc.ProductID
        WHERE pm.ProductID = @productId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Find product by ID with full variants, specifications, and assets for Admin editing.
   */
  async findProductByIdForAdmin(productId: bigint): Promise<RawQCQueueItem | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('productId', sql.BigInt, productId)
      .query<RawQCQueueItem>(`
        SELECT 
          pm.ProductID,
          pm.ParentSKU,
          pm.ProductName,
          pm.Description,
          pm.Highlights,
          pm.BaseModelCode,
          pm.HSNCode,
          pm.GSTRate,
          pm.CountryOfOrigin,
          pm.Status,
          pm.IsVerified,
          pm.CreatedAt,
          b.BrandID,
          b.BrandName,
          b.BrandCode,
          c.CategoryID,
          c.CategoryName,
          c.CategoryCode,
          u.UserID AS CreatorUserID,
          u.FirstName AS CreatorFirstName,
          u.LastName AS CreatorLastName,
          u.Email AS CreatorEmail,
          (
            SELECT 
              pv.ProductVariantID,
              pv.VariantSKU,
              pv.GTIN,
              pv.VariantModelCode,
              pv.Length,
              pv.Width,
              pv.Height,
              pv.NetWeight,
              pv.GrossWeight,
              pv.ShippingWeight,
              (
                SELECT pa.ProductAssetID, pa.AssetURL, pa.IsPrimary, pa.AltText, pa.DisplayOrder
                FROM dbo.ProductAssets pa
                WHERE pa.ProductVariantID = pv.ProductVariantID
                ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
                FOR JSON PATH
              ) AS AssetsJson,
              (
                SELECT pva.AttributeID, a.AttributeName, pva.AttributeValue, av.ValueName
                FROM dbo.ProductVariantAttributes pva
                JOIN dbo.Attributes a ON pva.AttributeID = a.AttributeID
                LEFT JOIN dbo.AttributeValues av ON pva.AttributeValueID = av.AttributeValueID
                WHERE pva.ProductVariantID = pv.ProductVariantID
                FOR JSON PATH
              ) AS AttributesJson,
              (
                SELECT uom.UOMCode, uom.UOMName, pvu.Quantity
                FROM dbo.ProductVariantUOMs pvu
                JOIN dbo.UOM uom ON pvu.UOMID = uom.UOMID
                WHERE pvu.ProductVariantID = pv.ProductVariantID
                FOR JSON PATH
              ) AS UOMsJson
            FROM dbo.ProductVariants pv
            WHERE pv.ProductMasterID = pm.ProductID
            FOR JSON PATH
          ) AS VariantsJson
        FROM dbo.ProductMaster pm
        LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
        LEFT JOIN dbo.ProductCategories pc ON pm.ProductID = pc.ProductID
        LEFT JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID
        LEFT JOIN dbo.Users u ON pm.CreatedBy = u.UserID
        WHERE pm.ProductID = @productId;
      `);

    return result.recordset[0] || null;
  }

  /**
   * Replace all assets for a variant.
   */
  async replaceVariantAssets(
    variantId: bigint,
    assets: Array<{ assetUrl: string; isPrimary: boolean; displayOrder?: number; altText?: string | null }>,
    userId: bigint
  ) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await tx.request()
        .input('variantId', sql.BigInt, variantId)
        .query('DELETE FROM dbo.ProductAssets WHERE ProductVariantID = @variantId');

      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        await tx.request()
          .input('variantId', sql.BigInt, variantId)
          .input('assetType', sql.VarChar(30), 'IMAGE')
          .input('assetUrl', sql.NVarChar(sql.MAX), a.assetUrl)
          .input('isPrimary', sql.Bit, a.isPrimary ? 1 : 0)
          .input('altText', sql.NVarChar(500), a.altText || null)
          .input('displayOrder', sql.Int, a.displayOrder ?? (i + 1))
          .input('userId', sql.BigInt, userId)
          .query(`
            INSERT INTO dbo.ProductAssets (
              ProductVariantID, AssetType, AssetURL, IsPrimary, AltText, DisplayOrder, Status, CreatedBy, CreatedAt
            )
            VALUES (
              @variantId, @assetType, @assetUrl, @isPrimary, @altText, @displayOrder, 'ACTIVE', @userId, GETDATE()
            )
          `);
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  /**
   * Update product QC status in transaction.
   */
  async updateProductQCStatus(
    productId: bigint,
    adminUserId: bigint,
    masterStatus: string,
    variantStatus: string,
    isVerified: boolean,
    tx: sql.Transaction
  ) {
    const req = new sql.Request(tx);
    await req
      .input('productId', sql.BigInt, productId)
      .input('adminUserId', sql.BigInt, adminUserId)
      .input('masterStatus', sql.VarChar(20), masterStatus)
      .input('variantStatus', sql.VarChar(20), variantStatus)
      .input('isVerified', sql.Bit, isVerified ? 1 : 0)
      .query(`
        UPDATE dbo.ProductMaster
        SET Status = @masterStatus,
            IsVerified = @isVerified,
            UpdatedAt = GETDATE(),
            UpdatedBy = @adminUserId
        WHERE ProductID = @productId;

        UPDATE dbo.ProductVariants
        SET Status = @variantStatus,
            UpdatedAt = GETDATE(),
            UpdatedBy = @adminUserId
        WHERE ProductMasterID = @productId;
      `);
  }

  /**
   * Update ProductMaster details.
   */
  async updateProductMaster(
    productId: bigint,
    data: {
      productName?: string;
      description?: string;
      highlights?: string | null;
      baseModelCode?: string | null;
      hsnCode?: string | null;
      gstRate?: number | null;
      countryOfOrigin?: string | null;
      brandId?: bigint;
      status?: string;
    },
    userId: bigint
  ): Promise<any> {
    const pool = await getPool();
    const req = pool.request()
      .input('productId', sql.BigInt, productId)
      .input('userId', sql.BigInt, userId);

    const setClauses: string[] = ['UpdatedAt = GETDATE()', 'UpdatedBy = @userId'];

    if (data.productName !== undefined) {
      req.input('productName', sql.NVarChar(255), data.productName);
      setClauses.push('ProductName = @productName');
    }
    if (data.description !== undefined) {
      req.input('description', sql.NVarChar(sql.MAX), data.description);
      setClauses.push('Description = @description');
    }
    if (data.highlights !== undefined) {
      req.input('highlights', sql.NVarChar(sql.MAX), data.highlights);
      setClauses.push('Highlights = @highlights');
    }
    if (data.baseModelCode !== undefined) {
      req.input('baseModelCode', sql.VarChar(100), data.baseModelCode);
      setClauses.push('BaseModelCode = @baseModelCode');
    }
    if (data.hsnCode !== undefined) {
      req.input('hsnCode', sql.VarChar(20), data.hsnCode);
      setClauses.push('HSNCode = @hsnCode');
    }
    if (data.gstRate !== undefined) {
      req.input('gstRate', sql.Decimal(5, 2), data.gstRate);
      setClauses.push('GSTRate = @gstRate');
    }
    if (data.countryOfOrigin !== undefined) {
      req.input('countryOfOrigin', sql.VarChar(100), data.countryOfOrigin);
      setClauses.push('CountryOfOrigin = @countryOfOrigin');
    }
    if (data.brandId !== undefined) {
      req.input('brandId', sql.BigInt, data.brandId);
      setClauses.push('BrandID = @brandId');
    }
    if (data.status !== undefined) {
      req.input('status', sql.VarChar(20), data.status);
      setClauses.push('Status = @status');
    }

    const query = `
      UPDATE dbo.ProductMaster
      SET ${setClauses.join(', ')}
      OUTPUT INSERTED.ProductID, INSERTED.ParentSKU, INSERTED.ProductName, INSERTED.Status
      WHERE ProductID = @productId;
    `;

    const result = await req.query(query);
    return result.recordset[0] || null;
  }

  /**
   * Sync/upsert Category Specifications across all variants of a product.
   */
  async upsertProductMasterSpecifications(
    productId: bigint,
    specifications: Array<{ attributeId: string; attributeValueId?: string | null; attributeValue: string }>,
    userId: bigint
  ): Promise<void> {
    const pool = await getPool();
    for (const spec of specifications) {
      const hasValId = spec.attributeValueId && String(spec.attributeValueId).trim();
      await pool.request()
        .input('productId', sql.BigInt, productId)
        .input('attributeId', sql.BigInt, BigInt(spec.attributeId))
        .input('attributeValueId', sql.BigInt, hasValId ? BigInt(spec.attributeValueId!) : null)
        .input('attributeValue', sql.NVarChar(255), spec.attributeValue)
        .input('userId', sql.BigInt, userId)
        .query(`
          MERGE dbo.ProductVariantAttributes AS target
          USING (
            SELECT v.ProductVariantID, @attributeId AS AttributeID, @attributeValueId AS AttributeValueID, @attributeValue AS AttributeValue
            FROM dbo.ProductVariants v
            WHERE v.ProductMasterID = @productId
          ) AS src
          ON target.ProductVariantID = src.ProductVariantID AND target.AttributeID = src.AttributeID
          WHEN MATCHED THEN
            UPDATE SET 
              AttributeValueID = src.AttributeValueID,
              AttributeValue = src.AttributeValue
          WHEN NOT MATCHED THEN
            INSERT (ProductVariantID, AttributeID, AttributeValueID, AttributeValue, CreatedBy, CreatedAt)
            VALUES (src.ProductVariantID, src.AttributeID, src.AttributeValueID, src.AttributeValue, @userId, GETDATE());
        `);
    }
  }

  /**
   * Update ProductVariant details.
   */
  async updateProductVariant(
    variantId: bigint,
    data: {
      gtin?: string | null;
      variantModelCode?: string | null;
      length?: number | null;
      width?: number | null;
      height?: number | null;
      weight?: number | null;
      netWeight?: number | null;
      grossWeight?: number | null;
      shippingWeight?: number | null;
      status?: string;
    },
    userId: bigint
  ): Promise<any> {
    const pool = await getPool();
    const req = pool.request()
      .input('variantId', sql.BigInt, variantId)
      .input('userId', sql.BigInt, userId);

    const setClauses: string[] = ['UpdatedAt = GETDATE()', 'UpdatedBy = @userId'];

    if (data.gtin !== undefined) {
      req.input('gtin', sql.VarChar(100), data.gtin);
      setClauses.push('GTIN = @gtin');
    }
    if (data.variantModelCode !== undefined) {
      req.input('variantModelCode', sql.VarChar(100), data.variantModelCode);
      setClauses.push('VariantModelCode = @variantModelCode');
    }
    if (data.length !== undefined) {
      req.input('length', sql.Decimal(12, 3), data.length);
      setClauses.push('Length = @length');
    }
    if (data.width !== undefined) {
      req.input('width', sql.Decimal(12, 3), data.width);
      setClauses.push('Width = @width');
    }
    if (data.height !== undefined) {
      req.input('height', sql.Decimal(12, 3), data.height);
      setClauses.push('Height = @height');
    }
    if (data.netWeight !== undefined || data.weight !== undefined) {
      const nw = data.netWeight !== undefined ? data.netWeight : data.weight;
      req.input('netWeight', sql.Decimal(12, 3), nw);
      setClauses.push('NetWeight = @netWeight');
    }
    if (data.grossWeight !== undefined) {
      req.input('grossWeight', sql.Decimal(12, 3), data.grossWeight);
      setClauses.push('GrossWeight = @grossWeight');
    }
    if (data.shippingWeight !== undefined) {
      req.input('shippingWeight', sql.Decimal(12, 3), data.shippingWeight);
      setClauses.push('ShippingWeight = @shippingWeight');
    }
    if (data.status !== undefined) {
      req.input('status', sql.VarChar(20), data.status);
      setClauses.push('Status = @status');
    }

    const query = `
      UPDATE dbo.ProductVariants
      SET ${setClauses.join(', ')}
      OUTPUT INSERTED.ProductVariantID, INSERTED.VariantSKU, INSERTED.Status
      WHERE ProductVariantID = @variantId;
    `;

    const result = await req.query(query);
    return result.recordset[0] || null;
  }

  /**
   * Get commercial listings for a seller.
   */
  async findSellerListings(sellerId: bigint): Promise<RawSellerProductListing[]> {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .query<RawSellerProductListing>(`
        SELECT 
          sp.SellerProductID,
          sp.SellerSKU,
          sp.MRP,
          sp.SellingPrice,
          sp.PurchasePrice,
          sp.PackerName,
          sp.ImporterName,
          sp.Status,
          sp.CreatedAt,
          pm.ProductID,
          pm.ParentSKU,
          pm.ProductName,
          b.BrandName,
          c.CategoryName,
          pv.VariantSKU,
          pv.GTIN,
          (
            SELECT pa.AssetURL, pa.IsPrimary
            FROM dbo.ProductAssets pa
            WHERE pa.ProductVariantID = pv.ProductVariantID AND pa.Status = 'ACTIVE'
            ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
            FOR JSON PATH
          ) AS AssetsJson,
          (
            SELECT a.AttributeName, pva.AttributeValue, av.ValueName
            FROM dbo.ProductVariantAttributes pva
            JOIN dbo.Attributes a ON pva.AttributeID = a.AttributeID
            LEFT JOIN dbo.AttributeValues av ON pva.AttributeValueID = av.AttributeValueID
            WHERE pva.ProductVariantID = pv.ProductVariantID
            FOR JSON PATH
          ) AS AttributesJson,
          (
            SELECT 
              wp.WarehouseProductID,
              wp.WarehouseSKU,
              wp.Status AS WarehouseProductStatus,
              w.WarehouseID,
              w.WarehouseName,
              w.WarehouseCode,
              w.WarehouseType,
              w.City,
              w.State,
              sw.IsPrimary,
              inv.InventoryID,
              ISNULL(inv.PhysicalQuantity, 0) AS PhysicalQuantity,
              ISNULL(inv.ReservedQuantity, 0) AS ReservedQuantity,
              ISNULL(inv.DamagedQuantity, 0) AS DamagedQuantity,
              ISNULL(inv.SafetyStockQuantity, 0) AS SafetyStockQuantity,
              CASE 
                WHEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) > 0 
                THEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) 
                ELSE 0 
              END AS AvailableQuantity,
              (
                SELECT 
                  ir.ReservationID, 
                  ir.OrderID, 
                  o.OrderNumber, 
                  ir.Quantity, 
                  ir.Status, 
                  ir.CreatedAt
                FROM dbo.InventoryReservations ir
                JOIN dbo.Orders o ON ir.OrderID = o.OrderID
                WHERE ir.InventoryID = inv.InventoryID AND ir.Status = 'RESERVED'
                FOR JSON PATH
              ) AS ActiveReservationsJson
            FROM dbo.WarehouseProducts wp
            JOIN dbo.Warehouses w ON wp.WarehouseID = w.WarehouseID
            LEFT JOIN dbo.SellerWarehouses sw ON (sw.WarehouseID = w.WarehouseID AND sw.SellerID = @sellerId)
            LEFT JOIN dbo.Inventory inv ON wp.WarehouseProductID = inv.WarehouseProductID
            WHERE wp.SellerProductID = sp.SellerProductID
            FOR JSON PATH
          ) AS WarehousesJson
        FROM dbo.SellerProducts sp
        JOIN dbo.ProductVariants pv ON sp.ProductVariantID = pv.ProductVariantID
        JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
        LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
        LEFT JOIN dbo.ProductCategories pc ON pm.ProductID = pc.ProductID
        LEFT JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID
        WHERE sp.SellerID = @sellerId
        ORDER BY sp.CreatedAt DESC
      `);

    return result.recordset;
  }

  /**
   * Find chronological inventory transactions for a specific seller product.
   */
  async findProductInventoryTransactions(sellerProductId: bigint, sellerId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerProductId', sql.BigInt, sellerProductId)
      .input('sellerId', sql.BigInt, sellerId)
      .query<{
        InventoryTransactionID: string | bigint;
        InventoryID: string | bigint;
        TransactionType: string;
        Quantity: number;
        Reason: string | null;
        PONumber: string | null;
        POAmount: number | null;
        PODocumentURL: string | null;
        GRNNumber: string | null;
        GRNAmount: number | null;
        GRNDocumentURL: string | null;
        SupplierInvoiceNumber: string | null;
        InvoiceAmount: number | null;
        InvoiceDocumentURL: string | null;
        CreatedAt: Date;
        WarehouseID: string | bigint;
        WarehouseName: string;
        WarehouseCode: string;
      }>(`
        SELECT 
          it.InventoryTransactionID,
          it.InventoryID,
          it.TransactionType,
          it.Quantity,
          it.Reason,
          it.PONumber,
          it.POAmount,
          it.PODocumentURL,
          it.GRNNumber,
          it.GRNAmount,
          it.GRNDocumentURL,
          it.SupplierInvoiceNumber,
          it.InvoiceAmount,
          it.InvoiceDocumentURL,
          it.CreatedAt,
          w.WarehouseID,
          w.WarehouseName,
          w.WarehouseCode
        FROM dbo.InventoryTransactions it
        JOIN dbo.Inventory inv ON it.InventoryID = inv.InventoryID
        JOIN dbo.WarehouseProducts wp ON inv.WarehouseProductID = wp.WarehouseProductID
        JOIN dbo.Warehouses w ON wp.WarehouseID = w.WarehouseID
        JOIN dbo.SellerProducts sp ON wp.SellerProductID = sp.SellerProductID
        WHERE sp.SellerProductID = @sellerProductId AND sp.SellerID = @sellerId
        ORDER BY it.CreatedAt DESC
      `);

    return result.recordset;
  }

  /**
   * Update seller product pricing and/or status.
   */
  async updateSellerProductPricing(
    sellerProductId: bigint,
    sellerId: bigint,
    data: {
      sellingPrice?: number;
      mrp?: number;
      status?: string;
      packerName?: string | null;
      importerName?: string | null;
      userId: bigint;
    }
  ) {
    const pool = await getPool();
    const req = pool.request()
      .input('sellerProductId', sql.BigInt, sellerProductId)
      .input('sellerId', sql.BigInt, sellerId)
      .input('userId', sql.BigInt, data.userId);

    const setClauses: string[] = ['UpdatedAt = GETDATE()', 'UpdatedBy = @userId'];

    if (data.sellingPrice !== undefined) {
      req.input('sellingPrice', sql.Decimal(18, 2), data.sellingPrice);
      setClauses.push('SellingPrice = @sellingPrice');
    }
    if (data.mrp !== undefined) {
      req.input('mrp', sql.Decimal(18, 2), data.mrp);
      setClauses.push('MRP = @mrp');
    }
    if (data.status !== undefined) {
      req.input('status', sql.VarChar(20), data.status);
      setClauses.push('Status = @status');
    }
    if (data.packerName !== undefined) {
      req.input('packerName', sql.NVarChar(255), data.packerName);
      setClauses.push('PackerName = @packerName');
    }
    if (data.importerName !== undefined) {
      req.input('importerName', sql.NVarChar(255), data.importerName);
      setClauses.push('ImporterName = @importerName');
    }

    const result = await req.query<{
      SellerProductID: string | bigint;
      SellerSKU: string;
      MRP: number;
      SellingPrice: number;
      PurchasePrice: number;
      PackerName: string | null;
      ImporterName: string | null;
      Status: string;
    }>(`
      UPDATE dbo.SellerProducts
      SET ${setClauses.join(', ')}
      OUTPUT 
        INSERTED.SellerProductID,
        INSERTED.SellerSKU,
        INSERTED.MRP,
        INSERTED.SellingPrice,
        INSERTED.PurchasePrice,
        INSERTED.PackerName,
        INSERTED.ImporterName,
        INSERTED.Status
      WHERE SellerProductID = @sellerProductId AND SellerID = @sellerId
    `);

    return result.recordset[0] || null;
  }

  /**
   * Find seller application for seller and category.
   */
  async findSellerApplication(sellerId: bigint, categoryId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .input('categoryId', sql.BigInt, categoryId)
      .query<{ SellerApplicationID: string | bigint; Status: string }>(`
        SELECT SellerApplicationID, Status
        FROM dbo.SellerApplications
        WHERE SellerID = @sellerId AND CategoryID = @categoryId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Update seller application to SUBMITTED.
   */
  async updateSellerApplicationToSubmitted(applicationId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('applicationId', sql.BigInt, applicationId)
      .query<{ SellerApplicationID: string | bigint }>(`
        UPDATE dbo.SellerApplications
        SET Status = 'SUBMITTED',
            SubmittedAt = GETDATE(),
            RejectionReason = NULL,
            UpdatedAt = GETDATE()
        OUTPUT INSERTED.SellerApplicationID
        WHERE SellerApplicationID = @applicationId
      `);

    return result.recordset[0];
  }

  /**
   * Create new seller application.
   */
  async createSellerApplication(sellerId: bigint, categoryId: bigint) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sellerId', sql.BigInt, sellerId)
      .input('categoryId', sql.BigInt, categoryId)
      .query<{ SellerApplicationID: string | bigint }>(`
        INSERT INTO dbo.SellerApplications (
          SellerID, CategoryID, Status, SubmittedAt, CreatedAt, UpdatedAt
        )
        OUTPUT INSERTED.SellerApplicationID
        VALUES (
          @sellerId, @categoryId, 'SUBMITTED', GETDATE(), GETDATE(), GETDATE()
        )
      `);

    return result.recordset[0];
  }

  /**
   * Upsert seller application document requirement.
   */
  async upsertSellerApplicationDocument(applicationId: bigint, documentTypeId: number, isMandatory: boolean) {
    const pool = await getPool();
    await pool.request()
      .input('applicationId', sql.BigInt, applicationId)
      .input('docTypeId', sql.Int, documentTypeId)
      .input('isMandatory', sql.Bit, isMandatory ? 1 : 0)
      .query(`
        MERGE dbo.SellerApplicationDocuments AS target
        USING (SELECT @applicationId AS SellerApplicationID, @docTypeId AS DocumentTypeID) AS source
        ON (target.SellerApplicationID = source.SellerApplicationID AND target.DocumentTypeID = source.DocumentTypeID)
        WHEN MATCHED THEN
          UPDATE SET 
            IsMandatory = @isMandatory,
            VerificationStatus = 'PENDING',
            RejectionReason = NULL,
            UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (SellerApplicationID, DocumentTypeID, IsMandatory, DocumentURL, VerificationStatus, CreatedAt)
          VALUES (@applicationId, @docTypeId, @isMandatory, '', 'PENDING', GETDATE());
      `);
  }

  /**
   * Insert status history record.
   */
  async createSellerStatusHistory(data: {
    sellerId: bigint;
    applicationId: bigint;
    status: string;
    comments: string;
    changedBy: bigint;
  }) {
    const pool = await getPool();
    await pool.request()
      .input('sellerId', sql.BigInt, data.sellerId)
      .input('applicationId', sql.BigInt, data.applicationId)
      .input('status', sql.VarChar(30), data.status)
      .input('comments', sql.NVarChar(sql.MAX), data.comments)
      .input('changedBy', sql.BigInt, data.changedBy)
      .query(`
        INSERT INTO dbo.SellerStatusHistory (
          SellerID, SellerApplicationID, Status, Comments, ChangedBy, ChangedAt, CreatedAt
        )
        VALUES (
          @sellerId, @applicationId, @status, @comments, @changedBy, GETDATE(), GETDATE()
        )
      `);
  }
}

export const productsRepository = new ProductsRepository();

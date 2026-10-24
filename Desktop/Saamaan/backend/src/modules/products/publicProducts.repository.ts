import { getPool, sql } from '../../database/db.js';

export interface RawStorefrontProduct {
  ProductID: string | bigint;
  ProductName: string;
  ParentSKU: string;
  Description: string | null;
  Highlights: string | null;
  CountryOfOrigin?: string | null;
  Status: string;
  CreatedAt: Date;
  BrandID: string | bigint | null;
  BrandName: string | null;
  BrandCode: string | null;
  BrandImageURL: string | null;
  CategoriesJson: string | null;
  VariantsJson: string | null;
}

export interface RawStorefrontProductDetail extends RawStorefrontProduct {
  ReturnPolicyJson: string | null;
  WarrantyPolicyJson: string | null;
}

export class PublicProductsRepository {
  /**
   * Retrieves active catalog products for the customer storefront.
   */
  async findStorefrontProducts(params: {
    category?: string;
    brandId?: string;
    q?: string;
    limit?: number;
  }): Promise<RawStorefrontProduct[]> {
    const pool = await getPool();
    const request = pool.request();

    const limit = params.limit || 50;
    request.input('limit', sql.Int, limit);

    const conditions: string[] = [
      "pm.Status IN ('ACTIVE', 'APPROVED')",
      "EXISTS (SELECT 1 FROM dbo.ProductVariants pv WHERE pv.ProductMasterID = pm.ProductID AND pv.Status = 'ACTIVE')",
    ];

    if (params.category && params.category !== 'All') {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM dbo.ProductCategories pc 
          JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID 
          WHERE pc.ProductID = pm.ProductID 
            AND (c.CategoryName LIKE @categoryPattern OR c.CategoryCode LIKE @categoryPattern)
        )
      `);
      request.input('categoryPattern', sql.NVarChar(100), `%${params.category}%`);
    }

    if (params.brandId) {
      conditions.push('pm.BrandID = @brandId');
      request.input('brandId', sql.BigInt, BigInt(params.brandId));
    }

    if (params.q) {
      const q = params.q.trim();
      conditions.push(`(
        pm.ProductName LIKE @qPattern
        OR pm.Description LIKE @qPattern
        OR pm.ParentSKU LIKE @qPattern
        OR b.BrandName LIKE @qPattern
      )`);
      request.input('qPattern', sql.NVarChar(255), `%${q}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      WITH StockCTE AS (
        SELECT 
          wp.SellerProductID,
          ISNULL(SUM(CASE 
            WHEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) > 0 
            THEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0))
            ELSE 0 
          END), 0) AS AvailableStock
        FROM dbo.WarehouseProducts wp WITH (NOLOCK)
        JOIN dbo.Inventory inv WITH (NOLOCK) ON wp.WarehouseProductID = inv.WarehouseProductID
        WHERE wp.Status = 'ACTIVE'
        GROUP BY wp.SellerProductID
      )
      SELECT 
        pm.ProductID,
        pm.ProductName,
        pm.ParentSKU,
        pm.Description,
        pm.Highlights,
        pm.Status,
        pm.CreatedAt,
        b.BrandID,
        b.BrandName,
        b.BrandCode,
        b.ImageURL AS BrandImageURL,
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
            pv.VariantModelCode,
            pv.GTIN,
            (
              SELECT pa.AssetURL, pa.IsPrimary, pa.DisplayOrder
              FROM dbo.ProductAssets pa
              WHERE pa.ProductVariantID = pv.ProductVariantID AND pa.Status = 'ACTIVE'
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
              SELECT 
                sp.SellerProductID, 
                sp.SellingPrice, 
                sp.MRP, 
                sp.Status,
                ISNULL(scte.AvailableStock, 0) AS AvailableStock
              FROM dbo.SellerProducts sp
              LEFT JOIN StockCTE scte ON sp.SellerProductID = scte.SellerProductID
              WHERE sp.ProductVariantID = pv.ProductVariantID AND sp.Status = 'ACTIVE'
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
      OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const result = await request.query<RawStorefrontProduct>(query);
    return result.recordset;
  }

  /**
   * Retrieves single product detailed information by ID.
   */
  async findStorefrontProductById(productId: bigint): Promise<RawStorefrontProductDetail | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('productId', sql.BigInt, productId)
      .query<RawStorefrontProductDetail>(`
        WITH StockCTE AS (
          SELECT 
            wp.SellerProductID,
            ISNULL(SUM(CASE 
              WHEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) > 0 
              THEN (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0))
              ELSE 0 
            END), 0) AS AvailableStock
          FROM dbo.WarehouseProducts wp WITH (NOLOCK)
          JOIN dbo.Inventory inv WITH (NOLOCK) ON wp.WarehouseProductID = inv.WarehouseProductID
          WHERE wp.Status = 'ACTIVE'
          GROUP BY wp.SellerProductID
        )
        SELECT TOP 1
          pm.ProductID,
          pm.ProductName,
          pm.ParentSKU,
          pm.Description,
          pm.Highlights,
          pm.CountryOfOrigin,
          pm.Status,
          pm.CreatedAt,
          b.BrandID,
          b.BrandName,
          b.BrandCode,
          b.ImageURL AS BrandImageURL,
          (
            SELECT 
              rrp.PolicyID,
              rrp.PolicyCode,
              rrp.PolicyName,
              rrp.IsReturnable,
              rrp.IsReplaceable,
              rrp.ReturnWindowDays,
              rrp.ReplacementWindowDays,
              rrp.RequiresTechnicianCheck,
              rrp.ConditionsSummary,
              rrp.TermsAndConditions
            FROM dbo.ReturnReplacementPolicies rrp
            WHERE rrp.PolicyID = pm.ReturnPolicyID
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
          ) AS ReturnPolicyJson,
          CAST(NULL AS NVARCHAR(MAX)) AS WarrantyPolicyJson,
          (
            SELECT 
              c.CategoryID, 
              c.CategoryName, 
              c.CategoryCode,
              (
                SELECT 
                  crrp.PolicyID,
                  crrp.PolicyCode,
                  crrp.PolicyName,
                  crrp.IsReturnable,
                  crrp.IsReplaceable,
                  crrp.ReturnWindowDays,
                  crrp.ReplacementWindowDays,
                  crrp.RequiresTechnicianCheck,
                  crrp.ConditionsSummary,
                  crrp.TermsAndConditions
                FROM dbo.ReturnReplacementPolicies crrp
                WHERE crrp.PolicyID = c.DefaultReturnPolicyID
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
              ) AS CategoryReturnPolicyJson
            FROM dbo.ProductCategories pc 
            JOIN dbo.Categories c ON pc.CategoryID = c.CategoryID 
            WHERE pc.ProductID = pm.ProductID 
            FOR JSON PATH
          ) AS CategoriesJson,
          (
            SELECT 
              pv.ProductVariantID,
              pv.VariantSKU,
              pv.VariantModelCode,
              pv.GTIN,
              (
                SELECT pa.ProductAssetID, pa.AssetURL, pa.IsPrimary, pa.DisplayOrder, pa.AltText
                FROM dbo.ProductAssets pa
                WHERE pa.ProductVariantID = pv.ProductVariantID AND pa.Status = 'ACTIVE'
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
                SELECT 
                  sp.SellerProductID, 
                  sp.SellingPrice, 
                  sp.MRP, 
                  sp.Status,
                  s.SellerID,
                  s.SellerName,
                  s.BusinessName,
                  ISNULL(scte.AvailableStock, 0) AS AvailableStock
                FROM dbo.SellerProducts sp
                LEFT JOIN dbo.Sellers s ON sp.SellerID = s.SellerID
                LEFT JOIN StockCTE scte ON sp.SellerProductID = scte.SellerProductID
                WHERE sp.ProductVariantID = pv.ProductVariantID AND sp.Status = 'ACTIVE'
                FOR JSON PATH
              ) AS SellerProductsJson
            FROM dbo.ProductVariants pv
            WHERE pv.ProductMasterID = pm.ProductID AND pv.Status = 'ACTIVE'
            FOR JSON PATH
          ) AS VariantsJson
        FROM dbo.ProductMaster pm
        LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
        WHERE pm.ProductID = @productId
      `);

    return result.recordset[0] || null;
  }
}

export const publicProductsRepository = new PublicProductsRepository();

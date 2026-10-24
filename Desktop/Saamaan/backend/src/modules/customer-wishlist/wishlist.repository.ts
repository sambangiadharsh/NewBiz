import { getPool, sql } from '../../database/db.js';

export interface WishlistItemDetail {
  wishlistItemId: string;
  wishlistId: string;
  productVariantId: string;
  createdAt: Date;
  product: {
    id: string;
    name: string;
    description: string | null;
    parentSku: string;
    brandName: string | null;
    thumbnail: string;
    price: number;
    originalPrice: number;
    inStock: boolean;
    variantSku: string;
    sellerProductId?: string | null;
  };
}

export class WishlistRepository {
  /**
   * Resolves a ProductMasterID (product ID) to an active ProductVariantID.
   */
  async resolveVariantId(productIdOrVariantId: bigint): Promise<bigint | null> {
    const pool = await getPool();

    // 1. Check if it's already a valid ProductVariantID
    const variantCheck = await pool
      .request()
      .input('id', sql.BigInt, productIdOrVariantId)
      .query<{ ProductVariantID: bigint }>(
        `SELECT TOP 1 ProductVariantID FROM dbo.ProductVariants WHERE ProductVariantID = @id AND Status = 'ACTIVE'`
      );

    if (variantCheck.recordset.length > 0) {
      return variantCheck.recordset[0].ProductVariantID;
    }

    // 2. Check if it's a ProductMasterID and pick first active variant
    const masterCheck = await pool
      .request()
      .input('id', sql.BigInt, productIdOrVariantId)
      .query<{ ProductVariantID: bigint }>(
        `SELECT TOP 1 ProductVariantID FROM dbo.ProductVariants WHERE ProductMasterID = @id AND Status = 'ACTIVE' ORDER BY ProductVariantID ASC`
      );

    if (masterCheck.recordset.length > 0) {
      return masterCheck.recordset[0].ProductVariantID;
    }

    return null;
  }

  /**
   * Fetches all active items in the customer's wishlist with rich product info.
   */
  async getWishlistItems(customerId: bigint): Promise<WishlistItemDetail[]> {
    const pool = await getPool();

    const query = `
      SELECT 
        w.WishlistID,
        w.ProductVariantID,
        w.CreatedAt,
        w.UpdatedAt,
        pm.ProductID,
        pm.ProductName,
        pm.Description,
        pm.ParentSKU,
        b.BrandName,
        pv.VariantSKU,
        (
          SELECT TOP 1 pa.AssetURL 
          FROM dbo.ProductAssets pa 
          WHERE pa.ProductVariantID = w.ProductVariantID AND pa.Status = 'ACTIVE'
          ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
        ) AS ThumbnailURL,
        (
          SELECT TOP 1 sp.SellerProductID
          FROM dbo.SellerProducts sp
          WHERE sp.ProductVariantID = w.ProductVariantID AND sp.Status = 'ACTIVE'
          ORDER BY sp.SellingPrice ASC
        ) AS SellerProductID,
        (
          SELECT TOP 1 sp.SellingPrice 
          FROM dbo.SellerProducts sp 
          WHERE sp.ProductVariantID = w.ProductVariantID AND sp.Status = 'ACTIVE'
          ORDER BY sp.SellingPrice ASC
        ) AS SellingPrice,
        (
          SELECT TOP 1 sp.MRP 
          FROM dbo.SellerProducts sp 
          WHERE sp.ProductVariantID = w.ProductVariantID AND sp.Status = 'ACTIVE'
          ORDER BY sp.SellingPrice ASC
        ) AS MRP
      FROM dbo.Wishlists w
      JOIN dbo.ProductVariants pv ON w.ProductVariantID = pv.ProductVariantID
      JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
      LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
      WHERE w.CustomerID = @customerId AND w.IsActive = 1
      ORDER BY w.UpdatedAt DESC
    `;

    const res = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .query<any>(query);

    return res.recordset.map((row) => ({
      wishlistItemId: String(row.WishlistID),
      wishlistId: String(row.WishlistID),
      productVariantId: String(row.ProductVariantID),
      createdAt: row.CreatedAt,
      product: {
        id: String(row.ProductID),
        name: row.ProductName,
        description: row.Description,
        parentSku: row.ParentSKU,
        brandName: row.BrandName,
        thumbnail: row.ThumbnailURL || '',
        price: row.SellingPrice ? Number(row.SellingPrice) : 0,
        originalPrice: row.MRP ? Number(row.MRP) : Number(row.SellingPrice || 0),
        inStock: true,
        variantSku: row.VariantSKU,
        sellerProductId: row.SellerProductID ? String(row.SellerProductID) : null,
      },
    }));
  }

  /**
   * Adds or revives an item in customer's wishlist (upsert with soft-delete revival).
   */
  async addItem(customerId: bigint, productVariantId: bigint): Promise<void> {
    const pool = await getPool();

    await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .input('variantId', sql.BigInt, productVariantId)
      .query(`
        IF EXISTS (
          SELECT 1 FROM dbo.Wishlists 
          WHERE CustomerID = @customerId AND ProductVariantID = @variantId
        )
        BEGIN
          UPDATE dbo.Wishlists 
          SET IsActive = 1, UpdatedAt = SYSDATETIME() 
          WHERE CustomerID = @customerId AND ProductVariantID = @variantId;
        END
        ELSE
        BEGIN
          INSERT INTO dbo.Wishlists (CustomerID, ProductVariantID, IsActive, CreatedAt, UpdatedAt)
          VALUES (@customerId, @variantId, 1, SYSDATETIME(), SYSDATETIME());
        END
      `);
  }

  /**
   * Soft-deletes an item from customer's wishlist (sets IsActive = 0).
   */
  async removeItem(customerId: bigint, identifier: bigint): Promise<void> {
    const pool = await getPool();

    await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .input('id', sql.BigInt, identifier)
      .query(`
        UPDATE w
        SET w.IsActive = 0, w.UpdatedAt = SYSDATETIME()
        FROM dbo.Wishlists w
        WHERE w.CustomerID = @customerId 
          AND (
            w.WishlistID = @id 
            OR w.ProductVariantID = @id
            OR w.ProductVariantID IN (
              SELECT pv.ProductVariantID 
              FROM dbo.ProductVariants pv 
              WHERE pv.ProductMasterID = @id
            )
          )
      `);
  }
}

export const wishlistRepository = new WishlistRepository();

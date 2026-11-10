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
    category?: string | null;
    thumbnail: string;
    price: number;
    originalPrice: number;
    inStock: boolean;
    variantSku: string;
    sellerProductId?: string | null;
  };
}

const CATEGORY_IMAGE_PRESETS: Record<string, string> = {
  ORGANIZER: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&auto=format&fit=crop&q=80',
  COOKER: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=800&auto=format&fit=crop&q=80',
  BACKPACK: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
  DEFAULT: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
};

function resolveWishlistThumbnail(thumbnailUrl: string | null | undefined, name: string, category: string | null | undefined): string {
  if (thumbnailUrl && (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://') || thumbnailUrl.startsWith('/uploads/'))) {
    return thumbnailUrl.replace(/\\/g, '/');
  }
  const combined = `${name || ''} ${category || ''}`.toUpperCase();
  if (combined.includes('DRAWER') || combined.includes('ORGANIZ') || combined.includes('STORAGE')) {
    return CATEGORY_IMAGE_PRESETS.ORGANIZER;
  }
  if (combined.includes('COOKER') || combined.includes('KITCHEN') || combined.includes('POT') || combined.includes('PAN')) {
    return CATEGORY_IMAGE_PRESETS.COOKER;
  }
  if (combined.includes('BACKPACK') || combined.includes('BAG') || combined.includes('TRAVEL')) {
    return CATEGORY_IMAGE_PRESETS.BACKPACK;
  }
  return CATEGORY_IMAGE_PRESETS.DEFAULT;
}

export class WishlistRepository {
  /**
   * Validates that the variant exists and is active.
   * Only queries dbo.ProductVariants by ProductVariantID.
   */
  async resolveVariantId(variantId: bigint): Promise<bigint | null> {
    const pool = await getPool();

    const variantCheck = await pool
      .request()
      .input('variantId', sql.BigInt, variantId)
      .query<{ ProductVariantID: bigint }>(
        `SELECT TOP 1 ProductVariantID FROM dbo.ProductVariants WHERE ProductVariantID = @variantId AND Status = 'ACTIVE'`
      );

    if (variantCheck.recordset.length > 0) {
      return variantCheck.recordset[0].ProductVariantID;
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
        (
          SELECT TOP 1 c2.CategoryName 
          FROM dbo.ProductCategories pc2
          JOIN dbo.Categories c2 ON pc2.CategoryID = c2.CategoryID
          WHERE pc2.ProductID = pm.ProductID
        ) AS CategoryName,
        pv.VariantSKU,
        (
          SELECT TOP 1 pa.AssetURL 
          FROM dbo.ProductAssets pa 
          WHERE (
            pa.ProductVariantID = w.ProductVariantID 
            OR (pm.ProductID IS NOT NULL AND pa.ProductVariantID IN (
              SELECT pv2.ProductVariantID FROM dbo.ProductVariants pv2 WHERE pv2.ProductMasterID = pm.ProductID
            ))
          )
          AND (pa.Status IS NULL OR pa.Status = 'ACTIVE')
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
        category: row.CategoryName || 'General',
        thumbnail: resolveWishlistThumbnail(row.ThumbnailURL, row.ProductName, row.CategoryName),
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

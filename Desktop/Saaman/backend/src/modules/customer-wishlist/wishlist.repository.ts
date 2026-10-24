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
   * Retrieves or creates an active wishlist for a customer.
   */
  async getOrCreateWishlistId(customerId: bigint): Promise<bigint> {
    const pool = await getPool();
    const existing = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .query<{ WishlistID: bigint }>(
        `SELECT TOP 1 WishlistID FROM Wishlists WHERE CustomerID = @customerId AND Status = 'ACTIVE' ORDER BY WishlistID DESC`
      );

    if (existing.recordset.length > 0) {
      return existing.recordset[0].WishlistID;
    }

    const insertResult = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .input('status', sql.VarChar(20), 'ACTIVE')
      .query<{ WishlistID: bigint }>(`
        INSERT INTO Wishlists (CustomerID, Status, CreatedAt)
        OUTPUT INSERTED.WishlistID
        VALUES (@customerId, @status, SYSDATETIME())
      `);

    return insertResult.recordset[0].WishlistID;
  }

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
        `SELECT TOP 1 ProductVariantID FROM ProductVariants WHERE ProductVariantID = @id AND Status = 'ACTIVE'`
      );

    if (variantCheck.recordset.length > 0) {
      return variantCheck.recordset[0].ProductVariantID;
    }

    // 2. Check if it's a ProductMasterID and pick first active variant
    const masterCheck = await pool
      .request()
      .input('id', sql.BigInt, productIdOrVariantId)
      .query<{ ProductVariantID: bigint }>(
        `SELECT TOP 1 ProductVariantID FROM ProductVariants WHERE ProductMasterID = @id AND Status = 'ACTIVE' ORDER BY ProductVariantID ASC`
      );

    if (masterCheck.recordset.length > 0) {
      return masterCheck.recordset[0].ProductVariantID;
    }

    return null;
  }

  /**
   * Fetches all items in the customer's active wishlist with rich product info.
   */
  async getWishlistItems(customerId: bigint): Promise<WishlistItemDetail[]> {
    const pool = await getPool();

    const query = `
      SELECT 
        wi.WishlistItemID,
        wi.WishlistID,
        wi.ProductVariantID,
        wi.CreatedAt,
        pm.ProductID,
        pm.ProductName,
        pm.Description,
        pm.ParentSKU,
        b.BrandName,
        pv.VariantSKU,
        (
          SELECT TOP 1 pa.AssetURL 
          FROM dbo.ProductAssets pa 
          WHERE pa.ProductVariantID = wi.ProductVariantID AND pa.Status = 'ACTIVE'
          ORDER BY pa.IsPrimary DESC, pa.DisplayOrder ASC
        ) AS ThumbnailURL,
        (
          SELECT TOP 1 sp.SellerProductID
          FROM dbo.SellerProducts sp
          WHERE sp.ProductVariantID = wi.ProductVariantID AND sp.Status = 'ACTIVE'
          ORDER BY sp.SellingPrice ASC
        ) AS SellerProductID,
        (
          SELECT TOP 1 sp.SellingPrice 
          FROM dbo.SellerProducts sp 
          WHERE sp.ProductVariantID = wi.ProductVariantID AND sp.Status = 'ACTIVE'
          ORDER BY sp.SellingPrice ASC
        ) AS SellingPrice,
        (
          SELECT TOP 1 sp.MRP 
          FROM dbo.SellerProducts sp 
          WHERE sp.ProductVariantID = wi.ProductVariantID AND sp.Status = 'ACTIVE'
          ORDER BY sp.SellingPrice ASC
        ) AS MRP
      FROM dbo.WishlistItems wi
      JOIN dbo.Wishlists w ON wi.WishlistID = w.WishlistID
      JOIN dbo.ProductVariants pv ON wi.ProductVariantID = pv.ProductVariantID
      JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
      LEFT JOIN dbo.Brands b ON pm.BrandID = b.BrandID
      WHERE w.CustomerID = @customerId
      ORDER BY wi.CreatedAt DESC
    `;

    const res = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .query<any>(query);

    return res.recordset.map((row) => ({
      wishlistItemId: String(row.WishlistItemID),
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
   * Adds an item to customer's wishlist (idempotent).
   */
  async addItem(customerId: bigint, productVariantId: bigint): Promise<void> {
    const pool = await getPool();
    const wishlistId = await this.getOrCreateWishlistId(customerId);

    // Prevent duplicates
    const check = await pool
      .request()
      .input('wishlistId', sql.BigInt, wishlistId)
      .input('variantId', sql.BigInt, productVariantId)
      .query(
        `SELECT 1 FROM dbo.WishlistItems WHERE WishlistID = @wishlistId AND ProductVariantID = @variantId`
      );

    if (check.recordset.length > 0) {
      return; // Already in wishlist
    }

    await pool
      .request()
      .input('wishlistId', sql.BigInt, wishlistId)
      .input('variantId', sql.BigInt, productVariantId)
      .query(
        `INSERT INTO dbo.WishlistItems (WishlistID, ProductVariantID, CreatedAt)
         VALUES (@wishlistId, @variantId, SYSDATETIME())`
      );
  }

  /**
   * Removes an item from the customer's wishlist by ProductVariantID, ProductMasterID, or WishlistItemID.
   */
  async removeItem(customerId: bigint, identifier: bigint): Promise<void> {
    const pool = await getPool();

    await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .input('id', sql.BigInt, identifier)
      .query(`
        DELETE wi
        FROM dbo.WishlistItems wi
        JOIN dbo.Wishlists w ON wi.WishlistID = w.WishlistID
        WHERE w.CustomerID = @customerId 
          AND (
            wi.WishlistItemID = @id 
            OR wi.ProductVariantID = @id
            OR wi.ProductVariantID IN (SELECT pv.ProductVariantID FROM dbo.ProductVariants pv WHERE pv.ProductMasterID = @id)
          )
      `);
  }
}

export const wishlistRepository = new WishlistRepository();

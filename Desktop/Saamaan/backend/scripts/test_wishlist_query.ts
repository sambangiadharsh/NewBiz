import { getPool } from '../src/database/db.js';
import sql from 'mssql';

async function main() {
  const pool = await getPool();

  const customerId = BigInt(3);
  const identifier = BigInt(16); // ProductID 16 for Hogo Pressure Cookers 06

  const check = await pool
    .request()
    .input('customerId', sql.BigInt, customerId)
    .input('id', sql.BigInt, identifier)
    .query(`
      SELECT wi.WishlistItemID, wi.ProductVariantID
      FROM dbo.WishlistItems wi
      JOIN dbo.Wishlists w ON wi.WishlistID = w.WishlistID
      WHERE w.CustomerID = @customerId 
        AND (
          wi.WishlistItemID = @id 
          OR wi.ProductVariantID = @id
          OR wi.ProductVariantID IN (SELECT pv.ProductVariantID FROM dbo.ProductVariants pv WHERE pv.ProductMasterID = @id)
        )
    `);

  console.log('MATCHED WISHLIST ITEMS FOR id=16:', check.recordset);

  // Also check if id=32 (ProductVariantID) matches:
  const check2 = await pool
    .request()
    .input('customerId', sql.BigInt, customerId)
    .input('id', sql.BigInt, BigInt(32))
    .query(`
      SELECT wi.WishlistItemID, wi.ProductVariantID
      FROM dbo.WishlistItems wi
      JOIN dbo.Wishlists w ON wi.WishlistID = w.WishlistID
      WHERE w.CustomerID = @customerId 
        AND (
          wi.WishlistItemID = @id 
          OR wi.ProductVariantID = @id
          OR wi.ProductVariantID IN (SELECT pv.ProductVariantID FROM dbo.ProductVariants pv WHERE pv.ProductMasterID = @id)
        )
    `);
  console.log('MATCHED WISHLIST ITEMS FOR id=32:', check2.recordset);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

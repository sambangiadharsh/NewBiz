import { getPool } from '../src/database/db.js';

async function main() {
  const pool = await getPool();

  const r = await pool.query(`
    SELECT 
      wi.WishlistItemID, 
      wi.WishlistID, 
      wi.ProductVariantID, 
      pv.ProductMasterID, 
      pm.ProductID,
      pm.ProductName,
      w.CustomerID
    FROM dbo.WishlistItems wi
    JOIN dbo.Wishlists w ON wi.WishlistID = w.WishlistID
    JOIN dbo.ProductVariants pv ON wi.ProductVariantID = pv.ProductVariantID
    JOIN dbo.ProductMaster pm ON pv.ProductMasterID = pm.ProductID
    WHERE w.CustomerID = 3
  `);
  console.log('WISHLIST ROWS FOR CUSTOMER 3:', r.recordset);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import { getPool } from '../src/database/db.js';
import { wishlistRepository } from '../src/modules/customer-wishlist/wishlist.repository.js';

async function main() {
  const pool = await getPool();

  console.log('--- BEFORE REMOVE ---');
  const before = await pool.query(`
    SELECT wi.*, w.CustomerID 
    FROM dbo.WishlistItems wi 
    JOIN dbo.Wishlists w ON wi.WishlistID = w.WishlistID
    WHERE w.CustomerID = 3
  `);
  console.log(before.recordset);

  // Try removing with ProductID 16 (Hogo Pressure Cooker)
  console.log('--- CALLING removeItem(3, 16) ---');
  await wishlistRepository.removeItem(BigInt(3), BigInt(16));

  console.log('--- AFTER REMOVE 16 ---');
  const after = await pool.query(`
    SELECT wi.*, w.CustomerID 
    FROM dbo.WishlistItems wi 
    JOIN dbo.Wishlists w ON wi.WishlistID = w.WishlistID
    WHERE w.CustomerID = 3
  `);
  console.log(after.recordset);

  // Restore it back for testing UI if needed
  await wishlistRepository.addItem(BigInt(3), BigInt(32));
  console.log('--- RESTORED VARIANT 32 ---');

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

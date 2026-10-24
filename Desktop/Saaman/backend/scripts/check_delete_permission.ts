import { getPool } from '../src/database/db.js';

async function main() {
  const pool = await getPool();

  try {
    // Check DELETE permission on CartItems
    await pool.query(`DELETE FROM dbo.CartItems WHERE 1=0`);
    console.log('DELETE on CartItems is PERMITTED!');
  } catch (err: any) {
    console.error('DELETE on CartItems ERROR:', err.message);
  }

  try {
    // Check DELETE permission on WishlistItems
    await pool.query(`DELETE FROM dbo.WishlistItems WHERE 1=0`);
    console.log('DELETE on WishlistItems is PERMITTED!');
  } catch (err: any) {
    console.error('DELETE on WishlistItems ERROR:', err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

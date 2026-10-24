import { getPool } from '../src/database/db.js';

async function main() {
  const pool = await getPool();

  const customers = await pool.query(`SELECT TOP 5 CustomerID, FirstName, Email FROM Customers`);
  console.log('CUSTOMERS:', customers.recordset);

  const wishlists = await pool.query(`SELECT TOP 10 * FROM Wishlists ORDER BY WishlistID DESC`);
  console.log('WISHLISTS:', wishlists.recordset);

  const wishlistItems = await pool.query(`SELECT TOP 10 * FROM WishlistItems ORDER BY WishlistItemID DESC`);
  console.log('WISHLIST_ITEMS:', wishlistItems.recordset);

  const carts = await pool.query(`SELECT TOP 10 * FROM Carts ORDER BY CartID DESC`);
  console.log('CARTS:', carts.recordset);

  const cartItems = await pool.query(`SELECT TOP 10 * FROM CartItems ORDER BY CartItemID DESC`);
  console.log('CART_ITEMS:', cartItems.recordset);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

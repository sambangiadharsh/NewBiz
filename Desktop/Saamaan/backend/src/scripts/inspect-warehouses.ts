import { getPool, closePool } from '../database/db.js';

async function run() {
  const pool = await getPool();
  const whs = await pool.request().query(`
    SELECT w.WarehouseID, w.WarehouseName, w.State, w.City, w.PostalCode, w.Status,
           sw.SellerID, sw.IsPrimary
    FROM dbo.Warehouses w
    LEFT JOIN dbo.SellerWarehouses sw ON w.WarehouseID = sw.WarehouseID
  `);
  console.log('Warehouses:', whs.recordset);
  await closePool();
}

run().catch(console.error);

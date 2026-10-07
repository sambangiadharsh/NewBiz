import { getPool, closePool } from '../database/db.js';

async function check() {
  const pool = await getPool();
  const result = await pool.request().query<{ TABLE_NAME: string }>(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME = 'WarehouseStatusHistory'
  `);
  console.log('WarehouseStatusHistory exists:', result.recordset.length > 0);
  await closePool();
}

check().catch(console.error);

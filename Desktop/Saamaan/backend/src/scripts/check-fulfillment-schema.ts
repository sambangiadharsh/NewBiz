import { getPool, closePool } from '../database/db.js';

async function run() {
  const pool = await getPool();
  const tables = ['Fulfillments', 'OrderItems', 'Invoices', 'Shipments', 'Inventory'];
  for (const t of tables) {
    const cols = await pool.request().query<{ COLUMN_NAME: string; DATA_TYPE: string }>(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = '${t}'
    `);
    console.log(`=== TABLE ${t} ===`);
    console.log(cols.recordset.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE})`).join(', '));
  }
  await closePool();
}

run().catch(console.error);

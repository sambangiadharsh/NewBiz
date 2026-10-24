import { checkDbHealth, getPool } from '../database/db.js';

async function main() {
  console.log('Testing MSSQL connection...');
  const health = await checkDbHealth();
  console.log('Health check passed:', health);

  const pool = await getPool();
  const tables = await pool.request().query<{ TABLE_NAME: string }>(`
    SELECT TOP 5 TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'
  `);
  console.log('Sample tables in Saamaan DB:', tables.recordset.map(r => r.TABLE_NAME));
  await pool.close();
  console.log('Connection closed cleanly.');
  process.exit(0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

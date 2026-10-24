import { getPool, closePool } from '../database/db.js';

async function run() {
  const pool = await getPool();
  // Check CHECK constraints on Fulfillments
  const constraints = await pool.request().query<{ CONSTRAINT_NAME: string; CHECK_CLAUSE: string }>(`
    SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
    FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
    JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc ON cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    WHERE tc.TABLE_NAME = 'Fulfillments'
  `);
  console.log('Fulfillment CHECK constraints:', constraints.recordset);

  // Check if OrderItems has FulfillmentID
  const colCheck = await pool.request().query<{ COLUMN_NAME: string }>(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'FulfillmentID'
  `);
  console.log('OrderItems has FulfillmentID:', colCheck.recordset.length > 0);

  // Check distinct statuses currently in Fulfillments
  const statuses = await pool.request().query<{ Status: string }>(`
    SELECT DISTINCT Status FROM dbo.Fulfillments
  `);
  console.log('Current distinct Fulfillment statuses:', statuses.recordset);

  await closePool();
}

run().catch(console.error);

import { getPool, closePool } from '../database/db.js';

async function run() {
  const pool = await getPool();
  console.log('=== Enforcing 1 Active Cart per Customer Migration ===');

  // 1. Clean up duplicate ACTIVE carts (keep the one with most items or latest, mark others as MERGED)
  console.log('\n1. Checking and cleaning duplicate ACTIVE carts in dbo.Carts...');
  const cleanupRes = await pool.request().query(`
    WITH RankedCarts AS (
      SELECT 
        c.CartID,
        c.CustomerID,
        c.Status,
        ROW_NUMBER() OVER (
          PARTITION BY c.CustomerID 
          ORDER BY (SELECT COUNT(*) FROM dbo.CartItems ci WHERE ci.CartID = c.CartID AND ISNULL(ci.Quantity, 0) > 0) DESC,
                   c.CartID DESC
        ) AS rn
      FROM dbo.Carts c
      WHERE c.Status = 'ACTIVE'
    )
    UPDATE dbo.Carts
    SET Status = 'MERGED', UpdatedAt = SYSDATETIME()
    WHERE CartID IN (
      SELECT CartID FROM RankedCarts WHERE rn > 1
    );
  `);
  console.log(`Cleaned up duplicate active carts. Rows affected: ${cleanupRes.rowsAffected[0] || 0}`);

  // 2. Create the Filtered Unique Index
  console.log('\n2. Creating Filtered Unique Index UQ_Carts_CustomerID_Active...');
  const indexCheck = await pool.request().query(`
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UQ_Carts_CustomerID_Active' AND object_id = OBJECT_ID('dbo.Carts')
  `);

  if (indexCheck.recordset.length === 0) {
    await pool.request().query(`
      CREATE UNIQUE NONCLUSTERED INDEX UQ_Carts_CustomerID_Active
      ON dbo.Carts (CustomerID)
      WHERE Status = 'ACTIVE';
    `);
    console.log('+ Created UNIQUE index UQ_Carts_CustomerID_Active ON dbo.Carts (CustomerID) WHERE Status = \'ACTIVE\'');
  } else {
    console.log('~ Index UQ_Carts_CustomerID_Active already exists.');
  }

  console.log('\n=== Migration Complete ===');
  await closePool();
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});


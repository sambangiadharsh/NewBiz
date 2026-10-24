import { getPool, closePool } from '../database/db.js';

async function main() {
  console.log('=== Migration: Add PackerName & ImporterName to SellerProducts ===\n');
  const pool = await getPool();

  await pool.request().query(`
    -- 1. Add PackerName if not exists
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SellerProducts' AND COLUMN_NAME = 'PackerName'
    )
    BEGIN
      ALTER TABLE [dbo].[SellerProducts] ADD [PackerName] NVARCHAR(255) NULL;
      PRINT '+ Added column SellerProducts.PackerName (NVARCHAR(255) NULL)';
    END
    ELSE
    BEGIN
      PRINT '~ SellerProducts.PackerName already exists, skipped';
    END

    -- 2. Add ImporterName if not exists
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SellerProducts' AND COLUMN_NAME = 'ImporterName'
    )
    BEGIN
      ALTER TABLE [dbo].[SellerProducts] ADD [ImporterName] NVARCHAR(255) NULL;
      PRINT '+ Added column SellerProducts.ImporterName (NVARCHAR(255) NULL)';
    END
    ELSE
    BEGIN
      PRINT '~ SellerProducts.ImporterName already exists, skipped';
    END
  `);

  // Verify columns in SellerProducts
  const res = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SellerProducts'
    ORDER BY ORDINAL_POSITION;
  `);

  console.log('\nCurrent SellerProducts Columns:');
  console.table(res.recordset);

  await closePool();
  console.log('\nMigration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

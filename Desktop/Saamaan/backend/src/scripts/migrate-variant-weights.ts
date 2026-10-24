import { getPool, closePool } from '../database/db.js';

async function main() {
  console.log('=== Migration: Update ProductVariants weights ===\n');
  const pool = await getPool();

  // 1. Rename Weight to NetWeight if Weight exists and NetWeight does not exist
  await pool.request().query(`
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ProductVariants' AND COLUMN_NAME = 'Weight'
    ) AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ProductVariants' AND COLUMN_NAME = 'NetWeight'
    )
    BEGIN
      EXEC sp_rename 'dbo.ProductVariants.Weight', 'NetWeight', 'COLUMN';
      PRINT '+ ProductVariants.Weight renamed to NetWeight';
    END
    ELSE IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ProductVariants' AND COLUMN_NAME = 'NetWeight'
    )
    BEGIN
      PRINT '~ ProductVariants.NetWeight already exists';
    END
    ELSE
    BEGIN
      ALTER TABLE [dbo].[ProductVariants] ADD [NetWeight] decimal(12,3) NULL;
      PRINT '+ ProductVariants.NetWeight added';
    END
  `);

  // 2. Add GrossWeight if not exists
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ProductVariants' AND COLUMN_NAME = 'GrossWeight'
    )
    BEGIN
      ALTER TABLE [dbo].[ProductVariants] ADD [GrossWeight] decimal(12,3) NULL;
      PRINT '+ ProductVariants.GrossWeight added';
    END
    ELSE
    BEGIN
      PRINT '~ ProductVariants.GrossWeight already exists';
    END
  `);

  // 3. Add ShippingWeight if not exists
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ProductVariants' AND COLUMN_NAME = 'ShippingWeight'
    )
    BEGIN
      ALTER TABLE [dbo].[ProductVariants] ADD [ShippingWeight] decimal(12,3) NULL;
      PRINT '+ ProductVariants.ShippingWeight added';
    END
    ELSE
    BEGIN
      PRINT '~ ProductVariants.ShippingWeight already exists';
    END
  `);

  // Print columns
  const res = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ProductVariants'
    AND COLUMN_NAME IN ('Weight', 'NetWeight', 'GrossWeight', 'ShippingWeight', 'Length', 'Width', 'Height', 'Capacity')
    ORDER BY ORDINAL_POSITION;
  `);

  console.log('\n=== ProductVariants Weight & Dimension Columns ===');
  console.table(res.recordset);
}

main()
  .catch(console.error)
  .finally(async () => {
    await closePool();
    process.exit(0);
  });

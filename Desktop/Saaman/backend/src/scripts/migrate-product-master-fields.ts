import { getPool, closePool } from '../database/db.js';

/**
 * Migration: Product Master Fields
 * ─────────────────────────────────────────────────────────
 * Adds to dbo.ProductMaster:
 *   - BaseModelCode   NVARCHAR(100) NULL  — brand family/base model identifier (e.g. "AH8050")
 *   - HSNCode         NVARCHAR(20)  NULL  — India GST classification code (e.g. "6404")
 *   - GSTRate         DECIMAL(5,2)  NULL  — GST % rate (e.g. 18.00, 12.00, 5.00)
 *
 * Adds to dbo.ProductVariants:
 *   - VariantModelCode NVARCHAR(100) NULL — manufacturer-specific variant part number (e.g. "AH8050-002")
 *     NOTE: Existing ProductModelCode column is kept untouched for backward compatibility.
 *
 * Safe to run multiple times — all changes are guarded with IF NOT EXISTS.
 */

async function main() {
  console.log('=== Migration: Product Master Fields ===\n');

  const pool = await getPool();

  // ─────────────────────────────────────────────
  // 1. ProductMaster — Add BaseModelCode
  // ─────────────────────────────────────────────
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME   = 'ProductMaster'
        AND COLUMN_NAME  = 'BaseModelCode'
    )
    BEGIN
      ALTER TABLE [dbo].[ProductMaster]
        ADD [BaseModelCode] NVARCHAR(100) NULL;
      PRINT '+ ProductMaster.BaseModelCode added';
    END
    ELSE
      PRINT '~ ProductMaster.BaseModelCode already exists, skipped';
  `);

  // ─────────────────────────────────────────────
  // 2. ProductMaster — Add HSNCode
  // ─────────────────────────────────────────────
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME   = 'ProductMaster'
        AND COLUMN_NAME  = 'HSNCode'
    )
    BEGIN
      ALTER TABLE [dbo].[ProductMaster]
        ADD [HSNCode] NVARCHAR(20) NULL;
      PRINT '+ ProductMaster.HSNCode added';
    END
    ELSE
      PRINT '~ ProductMaster.HSNCode already exists, skipped';
  `);

  // ─────────────────────────────────────────────
  // 3. ProductMaster — Add GSTRate
  // ─────────────────────────────────────────────
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME   = 'ProductMaster'
        AND COLUMN_NAME  = 'GSTRate'
    )
    BEGIN
      ALTER TABLE [dbo].[ProductMaster]
        ADD [GSTRate] DECIMAL(5,2) NULL;
      PRINT '+ ProductMaster.GSTRate added';
    END
    ELSE
      PRINT '~ ProductMaster.GSTRate already exists, skipped';
  `);

  // ─────────────────────────────────────────────
  // 4. ProductVariants — Add VariantModelCode
  //    (ProductModelCode stays for backward compat)
  // ─────────────────────────────────────────────
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME   = 'ProductVariants'
        AND COLUMN_NAME  = 'VariantModelCode'
    )
    BEGIN
      ALTER TABLE [dbo].[ProductVariants]
        ADD [VariantModelCode] NVARCHAR(100) NULL;
      PRINT '+ ProductVariants.VariantModelCode added';
    END
    ELSE
      PRINT '~ ProductVariants.VariantModelCode already exists, skipped';
  `);

  // ─────────────────────────────────────────────
  // 5. Verify — print final column lists
  // ─────────────────────────────────────────────
  const pmCols = await pool.request().query<{
    COLUMN_NAME: string;
    DATA_TYPE: string;
    IS_NULLABLE: string;
  }>(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ProductMaster'
    ORDER BY ORDINAL_POSITION
  `);

  console.log('\n=== dbo.ProductMaster (after migration) ===');
  pmCols.recordset.forEach((c) =>
    console.log(`  ${c.COLUMN_NAME.padEnd(20)} ${c.DATA_TYPE.padEnd(12)} nullable=${c.IS_NULLABLE}`)
  );

  const pvCols = await pool.request().query<{
    COLUMN_NAME: string;
    DATA_TYPE: string;
    IS_NULLABLE: string;
  }>(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ProductVariants'
    ORDER BY ORDINAL_POSITION
  `);

  console.log('\n=== dbo.ProductVariants (after migration) ===');
  pvCols.recordset.forEach((c) =>
    console.log(`  ${c.COLUMN_NAME.padEnd(22)} ${c.DATA_TYPE.padEnd(12)} nullable=${c.IS_NULLABLE}`)
  );

  console.log('\n✅ Migration complete.\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Migration failed:', e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });

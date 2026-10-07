import { getPool, closePool } from '../database/db.js';

async function main() {
  console.log('=== Migration: Drop moved columns from ProductVariants ===\n');
  const pool = await getPool();

  // SQL Server: drop default constraints first (required before column drop)
  const dropConstraintsSql = "DECLARE @sql NVARCHAR(MAX) = ''; SELECT @sql += 'ALTER TABLE [dbo].[ProductVariants] DROP CONSTRAINT [' + dc.name + '];' + CHAR(10) FROM sys.default_constraints dc JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = 'ProductVariants' AND c.name IN ('ProductModelCode', 'HSNCode', 'GSTRate'); IF LEN(@sql) > 0 BEGIN PRINT 'Dropping constraints...'; EXEC sp_executesql @sql; END ELSE PRINT 'No constraints found.';";
  await pool.request().query(dropConstraintsSql);
  console.log('Default constraints handled.');

  // Drop ProductModelCode (replaced by VariantModelCode)
  await pool.request().query("IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='ProductVariants' AND COLUMN_NAME='ProductModelCode') BEGIN ALTER TABLE [dbo].[ProductVariants] DROP COLUMN [ProductModelCode]; PRINT '- ProductModelCode dropped'; END ELSE PRINT '~ ProductModelCode not found';");
  console.log('ProductModelCode handled.');

  // Drop HSNCode (moved to ProductMaster)
  await pool.request().query("IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='ProductVariants' AND COLUMN_NAME='HSNCode') BEGIN ALTER TABLE [dbo].[ProductVariants] DROP COLUMN [HSNCode]; PRINT '- HSNCode dropped'; END ELSE PRINT '~ HSNCode not found';");
  console.log('HSNCode handled.');

  // Drop GSTRate (moved to ProductMaster)
  await pool.request().query("IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='ProductVariants' AND COLUMN_NAME='GSTRate') BEGIN ALTER TABLE [dbo].[ProductVariants] DROP COLUMN [GSTRate]; PRINT '- GSTRate dropped'; END ELSE PRINT '~ GSTRate not found';");
  console.log('GSTRate handled.');

  // Verify final state
  const pvCols = await pool.request().query<{ COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string }>(
    "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='ProductVariants' ORDER BY ORDINAL_POSITION"
  );
  console.log('\n=== dbo.ProductVariants (final) ===');
  pvCols.recordset.forEach((c) =>
    console.log('  ' + c.COLUMN_NAME.padEnd(22) + c.DATA_TYPE.padEnd(12) + 'nullable=' + c.IS_NULLABLE)
  );
  console.log('\n✅ Done.\n');
}

main()
  .catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); })
  .finally(async () => { await closePool(); });

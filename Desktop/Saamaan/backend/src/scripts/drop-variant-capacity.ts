import { getPool, closePool } from '../database/db.js';

async function main() {
  console.log('=== Migration: Drop Capacity column from ProductVariants ===\n');
  const pool = await getPool();

  // Drop default constraint if any exists on Capacity
  await pool.request().query(`
    DECLARE @sql NVARCHAR(MAX) = '';
    SELECT @sql += 'ALTER TABLE [dbo].[ProductVariants] DROP CONSTRAINT [' + dc.name + '];' + CHAR(10)
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = 'ProductVariants' AND c.name = 'Capacity';

    IF LEN(@sql) > 0
    BEGIN
      PRINT 'Dropping default constraint on Capacity...';
      EXEC sp_executesql @sql;
    END
  `);

  // Drop column Capacity if exists
  await pool.request().query(`
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ProductVariants' AND COLUMN_NAME = 'Capacity'
    )
    BEGIN
      ALTER TABLE [dbo].[ProductVariants] DROP COLUMN [Capacity];
      PRINT '+ Dropped ProductVariants.Capacity column';
    END
    ELSE
    BEGIN
      PRINT '~ ProductVariants.Capacity does not exist, skipped';
    END
  `);

  // Print remaining columns
  const res = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ProductVariants'
    ORDER BY ORDINAL_POSITION;
  `);

  console.log('\n=== dbo.ProductVariants Columns ===');
  console.table(res.recordset);
}

main()
  .catch(console.error)
  .finally(async () => {
    await closePool();
    process.exit(0);
  });

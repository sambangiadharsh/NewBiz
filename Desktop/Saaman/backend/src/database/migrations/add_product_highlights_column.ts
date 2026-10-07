import { getPool } from '../db.js';

export async function addProductHighlightsColumn() {
  try {
    const pool = await getPool();
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[ProductMaster]') 
        AND name = 'Highlights'
      )
      BEGIN
        ALTER TABLE [dbo].[ProductMaster] ADD [Highlights] NVARCHAR(MAX) NULL;
        PRINT 'Added [Highlights] column to [ProductMaster] table.';
      END
    `);
  } catch (err) {
    console.warn('Migration note (addProductHighlightsColumn):', err);
  }
}

if (process.argv[1]?.includes('add_product_highlights_column')) {
  addProductHighlightsColumn()
    .then(() => {
      console.log('Migration completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

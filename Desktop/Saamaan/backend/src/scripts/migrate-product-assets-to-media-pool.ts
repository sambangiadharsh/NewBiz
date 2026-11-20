import { getPool, closePool } from '../database/db.js';

/**
 * Migration Script: Option 1 (Media Pool + ProductVariantAssets)
 * Note: Uses PK + Indexes without explicit cross-table REFERENCES constraint
 * to adhere to host database security permissions.
 */
async function main() {
  console.log('=== Running Migration: Product Assets to Media Pool (Option 1) ===\n');

  const pool = await getPool();

  try {
    // -------------------------------------------------------------
    // Step 1: Create ProductVariantAssets table if not exists
    // -------------------------------------------------------------
    console.log('Step 1: Ensuring [dbo].[ProductVariantAssets] table exists...');
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.ProductVariantAssets', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[ProductVariantAssets] (
          [VariantAssetID]   BIGINT IDENTITY(1,1) NOT NULL,
          [ProductVariantID] BIGINT NOT NULL,
          [ProductAssetID]   BIGINT NOT NULL,
          [IsVariantCover]   BIT NOT NULL CONSTRAINT [DF_PVA_IsVariantCover] DEFAULT 0,
          [DisplayOrder]     INT NOT NULL CONSTRAINT [DF_PVA_DisplayOrder] DEFAULT 1,
          [CreatedAt]        DATETIME2 NOT NULL CONSTRAINT [DF_PVA_CreatedAt] DEFAULT SYSUTCDATETIME(),
          [CreatedBy]        BIGINT NULL,
          CONSTRAINT [PK_ProductVariantAssets] PRIMARY KEY CLUSTERED ([VariantAssetID])
        );

        CREATE UNIQUE NONCLUSTERED INDEX [UX_ProductVariantAssets_Variant_Cover]
          ON [dbo].[ProductVariantAssets] ([ProductVariantID])
          WHERE [IsVariantCover] = 1;

        CREATE UNIQUE NONCLUSTERED INDEX [UX_ProductVariantAssets_Variant_Asset]
          ON [dbo].[ProductVariantAssets] ([ProductVariantID], [ProductAssetID]);

        CREATE INDEX [IX_ProductVariantAssets_AssetID]
          ON [dbo].[ProductVariantAssets] ([ProductAssetID]);

        CREATE INDEX [IX_ProductVariantAssets_VariantID]
          ON [dbo].[ProductVariantAssets] ([ProductVariantID]);

        PRINT '+ Created table [dbo].[ProductVariantAssets]';
      END
      ELSE
      BEGIN
        PRINT '~ Table [dbo].[ProductVariantAssets] already exists';
      END
    `);

    // -------------------------------------------------------------
    // Step 2: Add ProductID column to ProductAssets if missing
    // -------------------------------------------------------------
    console.log('Step 2: Checking ProductID column on [dbo].[ProductAssets]...');
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME   = 'ProductAssets'
          AND COLUMN_NAME  = 'ProductID'
      )
      BEGIN
        ALTER TABLE [dbo].[ProductAssets]
          ADD [ProductID] BIGINT NULL;
        PRINT '+ Added [ProductID] column to [dbo].[ProductAssets]';
      END
      ELSE
      BEGIN
        PRINT '~ [ProductID] column already exists in [dbo].[ProductAssets]';
      END
    `);

    // -------------------------------------------------------------
    // Step 3: Backfill ProductID and ProductVariantAssets if ProductVariantID exists
    // -------------------------------------------------------------
    console.log('Step 3: Checking if data migration from ProductVariantID is needed...');
    const colCheck = await pool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME   = 'ProductAssets'
        AND COLUMN_NAME  = 'ProductVariantID'
    `);

    if (colCheck.recordset.length > 0) {
      console.log('Step 3a: Backfilling ProductID in [dbo].[ProductAssets] from ProductVariants...');
      await pool.request().query(`
        UPDATE pa
        SET pa.ProductID = pv.ProductMasterID
        FROM [dbo].[ProductAssets] pa
        JOIN [dbo].[ProductVariants] pv ON pa.ProductVariantID = pv.ProductVariantID
        WHERE pa.ProductID IS NULL;
      `);

      console.log('Step 3b: Backfilling existing variant mappings into [dbo].[ProductVariantAssets]...');
      await pool.request().query(`
        INSERT INTO [dbo].[ProductVariantAssets] 
          ([ProductVariantID], [ProductAssetID], [IsVariantCover], [DisplayOrder], [CreatedAt], [CreatedBy])
        SELECT 
          pa.[ProductVariantID],
          pa.[ProductAssetID],
          pa.[IsPrimary],
          pa.[DisplayOrder],
          pa.[CreatedAt],
          pa.[CreatedBy]
        FROM [dbo].[ProductAssets] pa
        WHERE pa.[ProductVariantID] IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM [dbo].[ProductVariantAssets] pva
            WHERE pva.[ProductVariantID] = pa.[ProductVariantID]
              AND pva.[ProductAssetID] = pa.[ProductAssetID]
          );
      `);

      console.log('Step 3c: Dropping old variant-level constraints/indexes and column...');
      await pool.request().query(`
        IF EXISTS (
          SELECT 1 FROM sys.foreign_keys
          WHERE name = 'FK_ProductAssets_ProductVariantID_ProductVariants_ProductVariantID'
        )
        BEGIN
          ALTER TABLE [dbo].[ProductAssets]
            DROP CONSTRAINT [FK_ProductAssets_ProductVariantID_ProductVariants_ProductVariantID];
          PRINT '- Dropped foreign key [FK_ProductAssets_ProductVariantID_ProductVariants_ProductVariantID]';
        END

        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UX_ProductAssets_Variant_Primary' AND object_id = OBJECT_ID(N'dbo.ProductAssets')
        )
        BEGIN
          DROP INDEX [UX_ProductAssets_Variant_Primary] ON [dbo].[ProductAssets];
          PRINT '- Dropped index [UX_ProductAssets_Variant_Primary]';
        END

        ALTER TABLE [dbo].[ProductAssets]
          DROP COLUMN [ProductVariantID];
        PRINT '- Dropped column [ProductVariantID] from [dbo].[ProductAssets]';
      `);
    }

    // -------------------------------------------------------------
    // Step 4: Add indexes to ProductAssets on ProductID
    // -------------------------------------------------------------
    console.log('Step 4: Ensuring ProductAssets indexes on ProductID...');
    await pool.request().query(`
      -- Ensure only one primary hero image per ProductID in ProductAssets
      ;WITH RankedAssets AS (
        SELECT ProductAssetID, ProductID, IsPrimary,
               ROW_NUMBER() OVER(PARTITION BY ProductID ORDER BY ProductAssetID ASC) AS rn
        FROM dbo.ProductAssets
        WHERE IsPrimary = 1
      )
      UPDATE RankedAssets
      SET IsPrimary = 0
      WHERE rn > 1;

      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'UX_ProductAssets_Product_Primary' AND object_id = OBJECT_ID(N'dbo.ProductAssets')
      )
      BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX [UX_ProductAssets_Product_Primary]
          ON [dbo].[ProductAssets] ([ProductID])
          WHERE [IsPrimary] = 1;
        PRINT '+ Created unique index [UX_ProductAssets_Product_Primary]';
      END

      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_ProductAssets_ProductID' AND object_id = OBJECT_ID(N'dbo.ProductAssets')
      )
      BEGIN
        CREATE INDEX [IX_ProductAssets_ProductID]
          ON [dbo].[ProductAssets] ([ProductID]);
        PRINT '+ Created index [IX_ProductAssets_ProductID]';
      END
    `);

    // -------------------------------------------------------------
    // Step 5: Verification
    // -------------------------------------------------------------
    console.log('Step 5: Verifying migration results...');
    const verifyRes = await pool.request().query(`
      SELECT 
        (SELECT COUNT(1) FROM dbo.ProductAssets) AS TotalAssets,
        (SELECT COUNT(1) FROM dbo.ProductVariantAssets) AS TotalVariantMappings,
        (SELECT COUNT(1) FROM dbo.ProductMaster) AS TotalProducts
    `);

    console.log('Verification status:', verifyRes.recordset[0]);
    console.log('\n=== Option 1 Migration Completed Successfully! ===');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();

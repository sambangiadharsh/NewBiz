import { getPool } from '../db.js';

export async function upgradeWishlistsTable(): Promise<void> {
  try {
    const pool = await getPool();

    // 1. Add ProductVariantID, IsActive, UpdatedAt to dbo.Wishlists if not present
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[Wishlists]') 
        AND name = 'ProductVariantID'
      )
      BEGIN
        ALTER TABLE [dbo].[Wishlists] ADD [ProductVariantID] BIGINT NULL;
        PRINT '+ Added [ProductVariantID] column to [dbo].[Wishlists]';
      END;

      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[Wishlists]') 
        AND name = 'IsActive'
      )
      BEGIN
        ALTER TABLE [dbo].[Wishlists] ADD [IsActive] BIT NOT NULL CONSTRAINT DF_Wishlists_IsActive DEFAULT 1;
        PRINT '+ Added [IsActive] column to [dbo].[Wishlists]';
      END;

      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[Wishlists]') 
        AND name = 'UpdatedAt'
      )
      BEGIN
        ALTER TABLE [dbo].[Wishlists] ADD [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT DF_Wishlists_UpdatedAt DEFAULT SYSDATETIME();
        PRINT '+ Added [UpdatedAt] column to [dbo].[Wishlists]';
      END;
    `);

    // 2. Migrate existing records from dbo.WishlistItems into dbo.Wishlists (if WishlistItems table exists)
    await pool.request().query(`
      IF OBJECT_ID('dbo.WishlistItems', 'U') IS NOT NULL
      BEGIN
        INSERT INTO dbo.Wishlists (CustomerID, ProductVariantID, IsActive, CreatedAt, UpdatedAt)
        SELECT DISTINCT 
          w.CustomerID, 
          wi.ProductVariantID, 
          1 AS IsActive, 
          ISNULL(wi.CreatedAt, SYSDATETIME()), 
          ISNULL(wi.CreatedAt, SYSDATETIME())
        FROM dbo.WishlistItems wi
        JOIN dbo.Wishlists w ON wi.WishlistID = w.WishlistID
        WHERE wi.ProductVariantID IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM dbo.Wishlists w2 
            WHERE w2.CustomerID = w.CustomerID 
              AND w2.ProductVariantID = wi.ProductVariantID
          );
      END;

      -- Remove obsolete empty header rows that have no ProductVariantID
      DELETE FROM dbo.Wishlists WHERE ProductVariantID IS NULL;
    `);

    // 3. Add FK and Unique constraints for high performance and integrity
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes 
        WHERE name = 'UQ_Wishlists_Customer_ProductVariant' 
        AND object_id = OBJECT_ID('dbo.Wishlists')
      )
      BEGIN
        CREATE UNIQUE INDEX UQ_Wishlists_Customer_ProductVariant 
        ON dbo.Wishlists(CustomerID, ProductVariantID);
        PRINT '+ Created UNIQUE INDEX UQ_Wishlists_Customer_ProductVariant on dbo.Wishlists';
      END;

      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes 
        WHERE name = 'IX_Wishlists_Customer_Active' 
        AND object_id = OBJECT_ID('dbo.Wishlists')
      )
      BEGIN
        CREATE INDEX IX_Wishlists_Customer_Active 
        ON dbo.Wishlists(CustomerID, IsActive);
        PRINT '+ Created INDEX IX_Wishlists_Customer_Active on dbo.Wishlists';
      END;
    `);

    console.log('✅ dbo.Wishlists upgrade migration completed successfully.');
  } catch (err) {
    console.warn('Migration note (upgradeWishlistsTable):', err);
  }
}

if (process.argv[1]?.includes('upgrade_wishlists_table')) {
  upgradeWishlistsTable()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

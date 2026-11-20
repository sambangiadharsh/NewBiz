-- =====================================================================
-- Migration: Migrate Product Assets to Product-Level Media Pool
-- Architecture: Option 1 (Shopify / Amazon Model)
-- 
-- 1. ProductAssets belongs directly to ProductMaster (ProductID)
-- 2. ProductVariantAssets maps ProductVariantID <-> ProductAssetID
-- =====================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

BEGIN TRANSACTION;

BEGIN TRY
    -- -------------------------------------------------------------
    -- 1. Create junction table: ProductVariantAssets (if not exists)
    -- -------------------------------------------------------------
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
            CONSTRAINT [PK_ProductVariantAssets] PRIMARY KEY CLUSTERED ([VariantAssetID]),
            CONSTRAINT [FK_ProductVariantAssets_ProductVariants] FOREIGN KEY ([ProductVariantID])
                REFERENCES [dbo].[ProductVariants] ([ProductVariantID]) ON DELETE CASCADE,
            CONSTRAINT [FK_ProductVariantAssets_ProductAssets] FOREIGN KEY ([ProductAssetID])
                REFERENCES [dbo].[ProductAssets] ([ProductAssetID]) ON DELETE CASCADE
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

    -- -------------------------------------------------------------
    -- 2. Add ProductID to ProductAssets if missing
    -- -------------------------------------------------------------
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

    -- -------------------------------------------------------------
    -- 3. Backfill ProductID from ProductVariants (if ProductVariantID exists)
    -- -------------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME   = 'ProductAssets'
          AND COLUMN_NAME  = 'ProductVariantID'
    )
    BEGIN
        UPDATE pa
        SET pa.ProductID = pv.ProductMasterID
        FROM [dbo].[ProductAssets] pa
        JOIN [dbo].[ProductVariants] pv ON pa.ProductVariantID = pv.ProductVariantID
        WHERE pa.ProductID IS NULL;

        PRINT '+ Backfilled ProductID in [dbo].[ProductAssets] from ProductVariants';

        -- -------------------------------------------------------------
        -- 4. Backfill existing mappings into ProductVariantAssets
        -- -------------------------------------------------------------
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

        PRINT '+ Backfilled existing variant mappings into [dbo].[ProductVariantAssets]';

        -- -------------------------------------------------------------
        -- 5. Drop old ProductVariantID constraints, indexes, and column
        -- -------------------------------------------------------------
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
    END

    -- -------------------------------------------------------------
    -- 6. Enforce NOT NULL and FK on ProductAssets.ProductID
    -- -------------------------------------------------------------
    ALTER TABLE [dbo].[ProductAssets]
        ALTER COLUMN [ProductID] BIGINT NOT NULL;

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = 'FK_ProductAssets_ProductID_ProductMaster_ProductID'
    )
    BEGIN
        ALTER TABLE [dbo].[ProductAssets]
            ADD CONSTRAINT [FK_ProductAssets_ProductID_ProductMaster_ProductID]
            FOREIGN KEY ([ProductID]) REFERENCES [dbo].[ProductMaster] ([ProductID]) ON DELETE CASCADE;
        PRINT '+ Added foreign key [FK_ProductAssets_ProductID_ProductMaster_ProductID]';
    END

    -- Filtered unique index: one primary hero image per ProductMaster
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

    COMMIT TRANSACTION;
    PRINT '=== Migration Completed Successfully ===';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();
    RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH;


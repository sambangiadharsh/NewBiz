import { prisma } from '../prisma.js';

export async function createDocumentRequirementsTables() {
  console.log('🔄 Creating SellerDocumentRequirements and WarehouseDocumentRequirements tables if they do not exist...');

  await prisma.$executeRawUnsafe(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SellerDocumentRequirements')
    BEGIN
      CREATE TABLE [SellerDocumentRequirements] (
        [SellerDocumentRequirementID] bigint IDENTITY(1,1),
        [DocumentTypeID] int NOT NULL,
        [IsRequired] bit NOT NULL DEFAULT 1,
        [IsActive] bit NOT NULL DEFAULT 1,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedBy] bigint NOT NULL,
        [UpdatedAt] datetime2,
        [UpdatedBy] bigint,
        CONSTRAINT [PK_SellerDocumentRequirements] PRIMARY KEY CLUSTERED ([SellerDocumentRequirementID]),
        CONSTRAINT [FK_SellerDocumentRequirements_DocumentTypeID_DocumentTypes] FOREIGN KEY ([DocumentTypeID]) REFERENCES [DocumentTypes]([DocumentTypeID]),
        CONSTRAINT [FK_SellerDocumentRequirements_CreatedBy_Users] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]),
        CONSTRAINT [FK_SellerDocumentRequirements_UpdatedBy_Users] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID])
      );

      CREATE UNIQUE NONCLUSTERED INDEX [UX_SellerDocumentRequirements_DocumentTypeID] 
      ON [SellerDocumentRequirements] ([DocumentTypeID]);

      PRINT 'Created SellerDocumentRequirements table and unique index.';
    END
    ELSE
    BEGIN
      PRINT 'SellerDocumentRequirements table already exists.';
    END
  `);

  await prisma.$executeRawUnsafe(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WarehouseDocumentRequirements')
    BEGIN
      CREATE TABLE [WarehouseDocumentRequirements] (
        [WarehouseDocumentRequirementID] bigint IDENTITY(1,1),
        [WarehouseType] varchar(20) NOT NULL,
        [DocumentTypeID] int NOT NULL,
        [IsRequired] bit NOT NULL DEFAULT 1,
        [IsActive] bit NOT NULL DEFAULT 1,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedBy] bigint NOT NULL,
        [UpdatedAt] datetime2,
        [UpdatedBy] bigint,
        CONSTRAINT [PK_WarehouseDocumentRequirements] PRIMARY KEY CLUSTERED ([WarehouseDocumentRequirementID]),
        CONSTRAINT [FK_WarehouseDocumentRequirements_DocumentTypeID_DocumentTypes] FOREIGN KEY ([DocumentTypeID]) REFERENCES [DocumentTypes]([DocumentTypeID]),
        CONSTRAINT [FK_WarehouseDocumentRequirements_CreatedBy_Users] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([UserID]),
        CONSTRAINT [FK_WarehouseDocumentRequirements_UpdatedBy_Users] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users]([UserID])
      );

      CREATE UNIQUE NONCLUSTERED INDEX [UX_WarehouseDocumentRequirements_WarehouseType_DocumentTypeID] 
      ON [WarehouseDocumentRequirements] ([WarehouseType], [DocumentTypeID]);

      PRINT 'Created WarehouseDocumentRequirements table and unique index.';
    END
    ELSE
    BEGIN
      PRINT 'WarehouseDocumentRequirements table already exists.';
    END
  `);

  console.log('✅ Document requirement tables verified in SQL Server.');
}

if (process.argv[1]?.includes('create_document_requirements_tables')) {
  createDocumentRequirementsTables()
    .catch((err) => {
      console.error('Migration error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

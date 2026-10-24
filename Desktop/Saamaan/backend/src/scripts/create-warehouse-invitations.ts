import { getPool, closePool } from '../database/db.js';

async function main() {
  console.log('Creating [dbo].[WarehouseInvitations] table if not exists...');

  const ddl = `
    IF NOT EXISTS (
      SELECT * FROM sys.tables t 
      JOIN sys.schemas s ON t.schema_id = s.schema_id 
      WHERE t.name = 'WarehouseInvitations' AND s.name = 'dbo'
    )
    BEGIN
      CREATE TABLE [dbo].[WarehouseInvitations] (
          [InvitationID]     BIGINT IDENTITY(1,1) NOT NULL,
          [WarehouseID]      BIGINT NOT NULL,
          [SellerID]         BIGINT NOT NULL,
          [Email]            VARCHAR(255) NOT NULL,
          [RoleName]         VARCHAR(50) NOT NULL CONSTRAINT [DF_WarehouseInvitations_RoleName] DEFAULT 'WAREHOUSE_MANAGER',
          [TokenHash]        VARCHAR(255) NOT NULL,
          [Status]           VARCHAR(30) NOT NULL CONSTRAINT [DF_WarehouseInvitations_Status] DEFAULT 'PENDING',
          [ExpiresAt]        DATETIME NOT NULL,
          [AcceptedAt]       DATETIME NULL,
          [AcceptedByUserID] BIGINT NULL,
          [CreatedBy]        BIGINT NOT NULL,
          [CreatedAt]        DATETIME NOT NULL CONSTRAINT [DF_WarehouseInvitations_CreatedAt] DEFAULT GETDATE(),
          [UpdatedAt]        DATETIME NULL,
          CONSTRAINT [PK_WarehouseInvitations] PRIMARY KEY CLUSTERED ([InvitationID] ASC)
      );

      CREATE NONCLUSTERED INDEX [IX_WarehouseInvitations_TokenHash] 
          ON [dbo].[WarehouseInvitations] ([TokenHash] ASC);

      CREATE NONCLUSTERED INDEX [IX_WarehouseInvitations_WarehouseID] 
          ON [dbo].[WarehouseInvitations] ([WarehouseID] ASC);

      CREATE NONCLUSTERED INDEX [IX_WarehouseInvitations_Email] 
          ON [dbo].[WarehouseInvitations] ([Email] ASC);

      PRINT 'WarehouseInvitations table created successfully.';
    END
    ELSE
    BEGIN
      PRINT 'WarehouseInvitations table already exists.';
    END
  `;

  const pool = await getPool();
  await pool.request().query(ddl);
  console.log('Done executing DDL for WarehouseInvitations.');
}

main()
  .catch((e) => {
    console.error('Error creating table:', e);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });

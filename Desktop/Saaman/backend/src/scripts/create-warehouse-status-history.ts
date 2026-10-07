import { getPool, closePool } from '../database/db.js';

async function main() {
  console.log('Creating [dbo].[WarehouseStatusHistory] table if not exists...');

  const ddl = `
    IF NOT EXISTS (
      SELECT * FROM sys.tables t 
      JOIN sys.schemas s ON t.schema_id = s.schema_id 
      WHERE t.name = 'WarehouseStatusHistory' AND s.name = 'dbo'
    )
    BEGIN
      CREATE TABLE [dbo].[WarehouseStatusHistory] (
          [WarehouseStatusHistoryID] BIGINT IDENTITY(1,1) NOT NULL,
          [WarehouseID]              BIGINT NOT NULL,
          [Status]                   VARCHAR(30) NOT NULL,
          [Comments]                 NVARCHAR(500) NULL,
          [ChangedBy]                BIGINT NOT NULL,
          [ChangedAt]                DATETIME NOT NULL CONSTRAINT [DF_WarehouseStatusHistory_ChangedAt] DEFAULT GETDATE(),
          [CreatedAt]                DATETIME NOT NULL CONSTRAINT [DF_WarehouseStatusHistory_CreatedAt] DEFAULT GETDATE(),
          CONSTRAINT [PK_WarehouseStatusHistory] PRIMARY KEY CLUSTERED ([WarehouseStatusHistoryID] ASC),
          CONSTRAINT [FK_WarehouseStatusHistory_WarehouseID_Warehouses_WarehouseID] 
              FOREIGN KEY ([WarehouseID]) REFERENCES [dbo].[Warehouses] ([WarehouseID]) ON UPDATE NO ACTION,
          CONSTRAINT [FK_WarehouseStatusHistory_ChangedBy_Users_UserID] 
              FOREIGN KEY ([ChangedBy]) REFERENCES [dbo].[Users] ([UserID]) ON UPDATE NO ACTION
      );

      CREATE NONCLUSTERED INDEX [IX_WarehouseStatusHistory_WarehouseID] 
          ON [dbo].[WarehouseStatusHistory] ([WarehouseID] ASC);

      PRINT 'WarehouseStatusHistory table created successfully.';
    END
    ELSE
    BEGIN
      PRINT 'WarehouseStatusHistory table already exists.';
    END
  `;

  const pool = await getPool();
  await pool.request().query(ddl);
  console.log('Done executing DDL.');
}

main()
  .catch((e) => {
    console.error('Error creating table:', e);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });

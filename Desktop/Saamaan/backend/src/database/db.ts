import sql from 'mssql';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Parses the SQL Server connection string into an mssql.config object.
 * Supports:
 *   sqlserver://host:port;database=...;user=...;password=...;encrypt=...;trustServerCertificate=...
 */
export function parseSqlServerConnectionString(connectionString: string): sql.config {
  let cleaned = connectionString.trim();
  if (cleaned.startsWith('sqlserver://')) {
    cleaned = cleaned.substring('sqlserver://'.length);
  }

  const parts = cleaned.split(';');
  const hostPart = parts[0] || '';
  let server = hostPart;
  let port = 1433;

  if (hostPart.includes(':')) {
    const [h, p] = hostPart.split(':');
    server = h;
    const parsedPort = parseInt(p, 10);
    if (!isNaN(parsedPort)) port = parsedPort;
  }

  const options: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const key = part.substring(0, eqIdx).trim().toLowerCase();
      const val = part.substring(eqIdx + 1).trim();
      options[key] = val;
    }
  }

  const dbConfig: sql.config = {
    server,
    port,
    user: options['user'] || options['username'] || options['uid'] || '',
    password: options['password'] || options['pwd'] || '',
    database: options['database'] || options['initial catalog'] || '',
    options: {
      encrypt: options['encrypt'] === 'true' || options['encrypt'] === 'yes',
      trustServerCertificate:
        options['trustservercertificate'] === 'true' || options['trustservercertificate'] === 'yes',
      enableArithAbort: true,
      useUTC: true,
    },
    pool: {
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: 30000,
  };

  return dbConfig;
}

let pool: sql.ConnectionPool | null = null;
let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  if (poolPromise) {
    return poolPromise;
  }

  poolPromise = (async () => {
    try {
      const dbConfig = parseSqlServerConnectionString(config.DATABASE_URL);
      logger.info(
        `Connecting to MSSQL database "${dbConfig.database}" at ${dbConfig.server}:${dbConfig.port}...`,
        'Database'
      );
      const newPool = new sql.ConnectionPool(dbConfig);

      newPool.on('error', (err) => {
        logger.error('Unexpected MSSQL Connection Pool error:', err, 'Database');
      });

      await newPool.connect();
      logger.info('MSSQL Connection Pool established successfully', 'Database');

      try {
        await newPool.request().query(`
          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'ReturnPolicyID'
          )
          BEGIN
            ALTER TABLE dbo.OrderItems ADD [ReturnPolicyID] INT NULL;
          END;

          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'ReturnPolicySnapshot'
          )
          BEGIN
            ALTER TABLE dbo.OrderItems ADD [ReturnPolicySnapshot] NVARCHAR(MAX) NULL;
          END;

          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'OrderItems' AND COLUMN_NAME = 'FulfillmentID'
          )
          BEGIN
            ALTER TABLE dbo.OrderItems ADD [FulfillmentID] BIGINT NULL;
          END;

          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'DestinationType'
          )
          BEGIN
            ALTER TABLE dbo.ReturnRequests ADD [DestinationType] VARCHAR(20) NULL;
          END;

          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'DestinationID'
          )
          BEGIN
            ALTER TABLE dbo.ReturnRequests ADD [DestinationID] BIGINT NULL;
          END;

          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'QCStatus'
          )
          BEGIN
            ALTER TABLE dbo.ReturnRequests ADD [QCStatus] VARCHAR(30) NULL;
          END;

          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'QCNotes'
          )
          BEGIN
            ALTER TABLE dbo.ReturnRequests ADD [QCNotes] NVARCHAR(1000) NULL;
          END;

          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'QCGrade'
          )
          BEGIN
            ALTER TABLE dbo.ReturnRequests ADD [QCGrade] VARCHAR(30) NULL;
          END;

          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'RestockedInventory'
          )
          BEGIN
            ALTER TABLE dbo.ReturnRequests ADD [RestockedInventory] BIT NOT NULL DEFAULT 0;
          END;

          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'RefundTransactionID'
          )
          BEGIN
            ALTER TABLE dbo.ReturnRequests ADD [RefundTransactionID] NVARCHAR(100) NULL;
          END;

          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'ReturnRequests' AND COLUMN_NAME = 'ReplacementOrderID'
          )
          BEGIN
            ALTER TABLE dbo.ReturnRequests ADD [ReplacementOrderID] BIGINT NULL;
          END;

          -- Re-align UQ_Active_ReturnRequest_Per_OrderItem to include all active pre-resolution statuses
          IF EXISTS (
            SELECT 1 FROM sys.indexes 
            WHERE name = 'UQ_Active_ReturnRequest_Per_OrderItem' 
              AND object_id = OBJECT_ID('dbo.ReturnRequests')
          )
          BEGIN
            DROP INDEX [UQ_Active_ReturnRequest_Per_OrderItem] ON dbo.ReturnRequests;
          END;

          CREATE UNIQUE NONCLUSTERED INDEX [UQ_Active_ReturnRequest_Per_OrderItem]
          ON dbo.ReturnRequests ([OrderItemID])
          WHERE [Status] IN ('REQUESTED', 'APPROVED', 'RECEIVED', 'QC_PASSED');

          -- Drop obsolete DefaultWarrantyPolicyID from dbo.Categories if present
          IF EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Categories' AND COLUMN_NAME = 'DefaultWarrantyPolicyID'
          )
          BEGIN
            DECLARE @defWarrantyConstraint NVARCHAR(256);
            SELECT @defWarrantyConstraint = d.name 
            FROM sys.tables t
            JOIN sys.columns c ON t.object_id = c.object_id
            JOIN sys.default_constraints d ON c.default_object_id = d.object_id
            WHERE t.name = 'Categories' AND c.name = 'DefaultWarrantyPolicyID';

            IF @defWarrantyConstraint IS NOT NULL
            BEGIN
              EXEC('ALTER TABLE dbo.Categories DROP CONSTRAINT [' + @defWarrantyConstraint + '];');
            END;

            DECLARE @fkWarrantyConstraint NVARCHAR(256);
            SELECT @fkWarrantyConstraint = fk.name
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.tables t ON fkc.parent_object_id = t.object_id
            JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
            WHERE t.name = 'Categories' AND c.name = 'DefaultWarrantyPolicyID';

            IF @fkWarrantyConstraint IS NOT NULL
            BEGIN
              EXEC('ALTER TABLE dbo.Categories DROP CONSTRAINT [' + @fkWarrantyConstraint + '];');
            END;

            ALTER TABLE dbo.Categories DROP COLUMN [DefaultWarrantyPolicyID];
          END;
        `);
        logger.info('Database OrderItems & ReturnRequests schema verified successfully', 'Database');
      } catch (schemaErr) {
        logger.warn('Schema verification encountered an issue (non-blocking): ' + (schemaErr as any)?.message, 'Database');
      }

      pool = newPool;
      return newPool;
    } catch (err) {
      logger.error('Failed to connect to MSSQL database:', err, 'Database');
      poolPromise = null;
      throw err;
    }
  })();

  return poolPromise;
}

/**
 * Transaction helper that automatically commits on success and rolls back on error. done majorly for use in service layer funct
 */
export async function withTransaction<T>(
  callback: (tx: sql.Transaction) => Promise<T>
): Promise<T> {
  const p = await getPool();
  const tx = new sql.Transaction(p);

  await tx.begin();
  try {
    const result = await callback(tx);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch (rbErr) {
      logger.error('Error during transaction rollback:', rbErr, 'Database');
    }
    throw error;
  }
}

/**
 * Health check helper for the raw SQL connection.
 */
export async function checkDbHealth(): Promise<{ status: string; latencyMs: number }> {
  const start = Date.now();
  const p = await getPool();
  await p.request().query('SELECT 1 AS HealthCheck');
  return {
    status: 'healthy',
    latencyMs: Date.now() - start,
  };
}

/**
 * Gracefully close the MSSQL Connection Pool.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    poolPromise = null;
    logger.info('MSSQL Connection Pool closed', 'Database');
  }
}

export { sql };

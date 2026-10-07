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
 * Transaction helper that automatically commits on success and rolls back on error.
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

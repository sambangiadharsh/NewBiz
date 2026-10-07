import crypto from 'crypto';
import { getPool, sql } from '../database/db.js';

// 32-character set excluding easily confused characters (0, O, 1, I)
const OPAQUE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a random opaque alphanumeric code (e.g. 7K4P9X)
 */
export function generateRandomOpaqueCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += OPAQUE_CHARS[bytes[i] % OPAQUE_CHARS.length];
  }
  return result;
}

/**
 * Generate a unique SellerCode in the format: SEL + 6-character random opaque code
 * Example: SEL7K4P9X
 */
export async function generateSellerCode(txOrPool?: any): Promise<string> {
  const runner = txOrPool ? (txOrPool.request ? txOrPool : await getPool()) : await getPool();

  for (let attempt = 0; attempt < 10; attempt++) {
    const opaque = generateRandomOpaqueCode(6);
    const code = `SEL${opaque}`;
    const result = await runner
      .request()
      .input('code', sql.VarChar(50), code)
      .query('SELECT TOP 1 SellerID FROM Sellers WHERE SellerCode = @code');

    if (result.recordset.length === 0) {
      return code;
    }
  }
  // In the extremely improbable case of multiple collisions, extend length
  return `SEL${generateRandomOpaqueCode(8)}`;
}

/**
 * Extract the opaque part from a seller code by stripping the SEL prefix.
 * Example: "SEL7K4P9X" -> "7K4P9X"
 */
export function extractSellerOpaqueCode(sellerCode: string): string {
  const stripped = sellerCode.replace(/^SEL_?/i, '').trim().toUpperCase();
  return stripped || sellerCode.trim().toUpperCase();
}

/**
 * Generate a sequential WarehouseCode in the format:
 * WH-{SellerCodeWithoutSEL}-{Sequence}
 * Example: WH-7K4P9X-001, WH-7K4P9X-002
 */
export async function generateWarehouseCode(sellerCode: string, txOrPool?: any): Promise<string> {
  const runner = txOrPool ? (txOrPool.request ? txOrPool : await getPool()) : await getPool();
  const opaque = extractSellerOpaqueCode(sellerCode);
  const prefix = `WH-${opaque}-`;

  const req: sql.Request = runner.request();
  const matching = await req
    .input('prefix', sql.VarChar(50), `${prefix}%`)
    .query(`
      SELECT WarehouseCode FROM Warehouses WHERE WarehouseCode LIKE @prefix
    `);

  let maxSeq = 0;
  for (const wh of matching.recordset) {
    const code = wh.WarehouseCode || '';
    const seqStr = code.slice(prefix.length);
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed) && parsed > maxSeq) {
      maxSeq = parsed;
    }
  }

  let nextSeq = maxSeq + 1;
  let candidateCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;

  // Guard against race conditions during simultaneous registrations
  while (true) {
    const existing = await runner
      .request()
      .input('candidateCode', sql.VarChar(50), candidateCode)
      .query('SELECT TOP 1 WarehouseID FROM Warehouses WHERE WarehouseCode = @candidateCode');

    if (existing.recordset.length === 0) {
      break;
    }
    nextSeq++;
    candidateCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  return candidateCode;
}

/**
 * Generate a sequential WarehouseCode for platform / admin-managed hubs
 * Example: WH-PLT-001
 */
export async function generatePlatformWarehouseCode(txOrPool?: any): Promise<string> {
  const runner = txOrPool ? (txOrPool.request ? txOrPool : await getPool()) : await getPool();
  const prefix = 'WH-PLT-';

  const req: sql.Request = runner.request();
  const matching = await req
    .input('prefix', sql.VarChar(50), `${prefix}%`)
    .query(`
      SELECT WarehouseCode FROM Warehouses WHERE WarehouseCode LIKE @prefix
    `);

  let maxSeq = 0;
  for (const wh of matching.recordset) {
    const parsed = parseInt((wh.WarehouseCode || '').slice(prefix.length), 10);
    if (!isNaN(parsed) && parsed > maxSeq) {
      maxSeq = parsed;
    }
  }

  let nextSeq = maxSeq + 1;
  let candidateCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;

  while (true) {
    const existing = await runner
      .request()
      .input('candidateCode', sql.VarChar(50), candidateCode)
      .query('SELECT TOP 1 WarehouseID FROM Warehouses WHERE WarehouseCode = @candidateCode');

    if (existing.recordset.length === 0) {
      break;
    }
    nextSeq++;
    candidateCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  return candidateCode;
}

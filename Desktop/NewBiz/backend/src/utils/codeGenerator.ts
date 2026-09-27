import crypto from 'crypto';
import { prisma as defaultPrisma } from '../database/prisma.js';

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
export async function generateSellerCode(db: any = defaultPrisma): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const opaque = generateRandomOpaqueCode(6);
    const code = `SEL${opaque}`;
    const existing = await db.sellers.findFirst({
      where: { SellerCode: code },
      select: { SellerID: true },
    });
    if (!existing) {
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
export async function generateWarehouseCode(sellerCode: string, db: any = defaultPrisma): Promise<string> {
  const opaque = extractSellerOpaqueCode(sellerCode);
  const prefix = `WH-${opaque}-`;

  const matching = await db.warehouses.findMany({
    where: {
      WarehouseCode: {
        startsWith: prefix,
      },
    },
    select: {
      WarehouseCode: true,
    },
  });

  let maxSeq = 0;
  for (const wh of matching) {
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
  while (
    await db.warehouses.findFirst({
      where: { WarehouseCode: candidateCode },
      select: { WarehouseID: true },
    })
  ) {
    nextSeq++;
    candidateCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  return candidateCode;
}

/**
 * Generate a sequential WarehouseCode for platform / admin-managed hubs
 * Example: WH-PLT-001
 */
export async function generatePlatformWarehouseCode(db: any = defaultPrisma): Promise<string> {
  const prefix = 'WH-PLT-';
  const matching = await db.warehouses.findMany({
    where: {
      WarehouseCode: {
        startsWith: prefix,
      },
    },
    select: {
      WarehouseCode: true,
    },
  });

  let maxSeq = 0;
  for (const wh of matching) {
    const parsed = parseInt((wh.WarehouseCode || '').slice(prefix.length), 10);
    if (!isNaN(parsed) && parsed > maxSeq) {
      maxSeq = parsed;
    }
  }

  let nextSeq = maxSeq + 1;
  let candidateCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;

  while (
    await db.warehouses.findFirst({
      where: { WarehouseCode: candidateCode },
      select: { WarehouseID: true },
    })
  ) {
    nextSeq++;
    candidateCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  return candidateCode;
}

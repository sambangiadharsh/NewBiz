import crypto from 'crypto';
import { Request } from 'express';

/**
 * Generates a cryptographically strong random token string (80 hex characters)
 */
export const generateRefreshTokenString = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * Produces a SHA-256 hash of the refresh token to store in the database.
 * This guarantees that even if database reads are compromised, raw tokens cannot be utilized.
 */
export const hashRefreshToken = (rawToken: string): string => {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
};

/**
 * Resolves the portal-specific refresh token cookie name.
 */
export const getPortalRefreshTokenCookieName = (req: Request): string => {
  const portalHeader = (req.headers['x-portal-type'] as string | undefined)?.toLowerCase();
  if (portalHeader === 'admin') return 'admin_refresh_token';
  if (portalHeader === 'seller') return 'seller_refresh_token';
  if (portalHeader === 'warehouse') return 'warehouse_refresh_token';
  if (portalHeader === 'customer') return 'customer_refresh_token';

  const origin = req.headers.origin || req.headers.referer || '';
  if (origin.includes('7001') || origin.includes('5173') || origin.includes('admin')) return 'admin_refresh_token';
  if (origin.includes('7002') || origin.includes('5174') || origin.includes('seller')) return 'seller_refresh_token';
  if (origin.includes('7003') || origin.includes('5175') || origin.includes('warehouse')) return 'warehouse_refresh_token';
  if (origin.includes('7004') || origin.includes('5176') || origin.includes('customer')) return 'customer_refresh_token';

  return 'refresh_token';
};

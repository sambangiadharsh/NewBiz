import { Request } from 'express';

/**
 * Resolves the portal-specific cookie name (admin_token, seller_token, warehouse_token)
 * based on the X-Portal-Type request header or origin/referer.
 */
export const getPortalCookieName = (req: Request): string => {
  const portalHeader = (req.headers['x-portal-type'] as string | undefined)?.toLowerCase();
  if (portalHeader === 'admin') return 'admin_token';
  if (portalHeader === 'seller') return 'seller_token';
  if (portalHeader === 'warehouse') return 'warehouse_token';
  if (portalHeader === 'customer') return 'customer_token';

  const origin = req.headers.origin || req.headers.referer || '';
  if (origin.includes('7001') || origin.includes('5173') || origin.includes('admin')) return 'admin_token';
  if (origin.includes('7002') || origin.includes('5174') || origin.includes('seller')) return 'seller_token';
  if (origin.includes('7003') || origin.includes('5175') || origin.includes('warehouse')) return 'warehouse_token';
  if (origin.includes('7004') || origin.includes('5176') || origin.includes('customer')) return 'customer_token';

  return 'token';
};

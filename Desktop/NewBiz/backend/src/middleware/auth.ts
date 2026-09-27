import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../database/prisma.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { JwtPayload, AuthUser } from '../types/auth.js';
import { getPortalCookieName } from '../utils/portalCookie.js';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;
    const cookieName = getPortalCookieName(req);

    // 1. Check portal-specific httpOnly cookie (admin_token, seller_token, warehouse_token)
    if (req.cookies && req.cookies[cookieName]) {
      token = req.cookies[cookieName];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token is missing. Please log in');
    }

    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    const userIdBigInt = BigInt(decoded.userId);
    const user = await prisma.users.findUnique({
      where: { UserID: userIdBigInt },
      include: {
        UserRoles_UserRoles_UserIDToUsers: {
          include: {
            Roles: {
              include: {
                RolePermissions: {
                  include: {
                    Permissions: true,
                  },
                },
              },
            },
          },
        },
        SellerUsers_SellerUsers_UserIDToUsers: {
          include: {
            Sellers: true,
          },
        },
        WarehouseUsers_WarehouseUsers_UserIDToUsers: {
          include: {
            Warehouses: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    if (user.Status !== 'ACTIVE') {
      throw new UnauthorizedError(`Account is ${user.Status.toLowerCase()}. Access denied`);
    }

    // Extract active roles
    const userRoles = user.UserRoles_UserRoles_UserIDToUsers;
    const roles = userRoles
      .filter((ur) => ur.Roles.Status === 'ACTIVE')
      .map((ur) => ur.Roles.RoleName);

    // Extract unique permissions
    const permissionsSet = new Set<string>();
    for (const ur of userRoles) {
      if (ur.Roles.Status === 'ACTIVE') {
        for (const rp of ur.Roles.RolePermissions) {
          permissionsSet.add(rp.Permissions.PermissionCode);
        }
      }
    }

    // Extract active seller associations
    const sellerUsers = user.SellerUsers_SellerUsers_UserIDToUsers;
    const sellers = sellerUsers
      .filter((su) => su.Status === 'ACTIVE' && su.Sellers.Status === 'ACTIVE')
      .map((su) => ({
        sellerId: String(su.Sellers.SellerID),
        sellerCode: su.Sellers.SellerCode,
        sellerName: su.Sellers.SellerName,
        status: su.Sellers.Status,
      }));

    // Extract active warehouse associations
    const warehouseUsers = user.WarehouseUsers_WarehouseUsers_UserIDToUsers;
    let warehouses = warehouseUsers
      .filter((wu) => wu.Status === 'ACTIVE')
      .map((wu) => ({
        warehouseId: String(wu.Warehouses.WarehouseID),
        warehouseCode: wu.Warehouses.WarehouseCode,
        warehouseName: wu.Warehouses.WarehouseName,
        warehouseType: wu.Warehouses.WarehouseType,
        status: wu.Warehouses.Status,
      }));

    if (warehouses.length === 0 && (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN'))) {
      const activePlatformWarehouses = await prisma.warehouses.findMany({
        where: { Status: 'ACTIVE' },
        orderBy: { WarehouseID: 'asc' },
        take: 10,
      });
      warehouses = activePlatformWarehouses.map((wh) => ({
        warehouseId: String(wh.WarehouseID),
        warehouseCode: wh.WarehouseCode,
        warehouseName: wh.WarehouseName,
        warehouseType: wh.WarehouseType,
        status: wh.Status,
      }));
    }

    const authUser: AuthUser = {
      userId: String(user.UserID),
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
      status: user.Status,
      roles,
      permissions: Array.from(permissionsSet),
      sellers,
      warehouses,
    };

    req.user = authUser;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRoles = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // SUPER_ADMIN has platform-wide super role
    if (req.user.roles.includes('SUPER_ADMIN')) {
      return next();
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return next(
        new ForbiddenError(
          `Insufficient permissions. Required roles: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
};

export const requirePermissions = (...requiredPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // SUPER_ADMIN bypasses granular permission check
    if (req.user.roles.includes('SUPER_ADMIN')) {
      return next();
    }

    const hasAllPermissions = requiredPermissions.every((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasAllPermissions) {
      return next(
        new ForbiddenError(
          `Insufficient permissions. Required: [${requiredPermissions.join(', ')}]`
        )
      );
    }

    next();
  };
};

export const requireSellerAccess = (paramKey = 'sellerId') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // SUPER_ADMIN and platform ADMIN have administrative access
    if (req.user.roles.includes('SUPER_ADMIN') || req.user.roles.includes('ADMIN')) {
      return next();
    }

    const targetSellerId =
      req.params[paramKey] ||
      req.body?.[paramKey] ||
      (req.query?.[paramKey] as string | undefined);

    if (!targetSellerId) {
      return next(new ForbiddenError('Target seller ID is missing in request'));
    }

    const hasAccess = req.user.sellers.some(
      (s) => s.sellerId === String(targetSellerId)
    );

    if (!hasAccess) {
      return next(new ForbiddenError('You do not have authorization to access this seller'));
    }

    next();
  };
};

export const requireWarehouseAccess = (paramKey = 'warehouseId') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // SUPER_ADMIN and platform ADMIN have administrative access
    if (req.user.roles.includes('SUPER_ADMIN') || req.user.roles.includes('ADMIN')) {
      return next();
    }

    const targetWarehouseId =
      req.params[paramKey] ||
      req.body?.[paramKey] ||
      (req.query?.[paramKey] as string | undefined);

    if (!targetWarehouseId) {
      return next(new ForbiddenError('Target warehouse ID is missing in request'));
    }

    const hasAccess = req.user.warehouses.some(
      (w) => w.warehouseId === String(targetWarehouseId)
    );

    if (!hasAccess) {
      return next(new ForbiddenError('You do not have authorization to access this warehouse'));
    }

    next();
  };
};

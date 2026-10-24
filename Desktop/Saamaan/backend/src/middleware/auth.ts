import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { authRepository } from '../modules/auth/auth.repository.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { JwtPayload, AuthUser } from '../types/auth.js';
import { getPortalCookieName } from '../utils/portalCookie.js';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;
    const cookieName = getPortalCookieName(req);

    // 1. Prefer explicit Authorization header sent by client SPA
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    } else if (req.cookies && req.cookies[cookieName]) {
      token = req.cookies[cookieName];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
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
    let authUser: AuthUser | null = null;

    if (decoded.roles && decoded.roles.includes('CUSTOMER')) {
      const customer = await authRepository.findCustomerById(userIdBigInt);
      if (!customer) {
        throw new UnauthorizedError('Customer account not found');
      }
      if (customer.Status !== 'ACTIVE') {
        throw new UnauthorizedError(`Account is ${customer.Status.toLowerCase()}. Access denied`);
      }
      authUser = {
        userId: String(customer.CustomerID),
        email: customer.Email || '',
        firstName: customer.FirstName,
        lastName: customer.LastName,
        status: customer.Status,
        roles: ['CUSTOMER'],
        permissions: [],
        sellers: [],
        warehouses: [],
      };
    } else {
      authUser = await authRepository.getUserAuthContext(userIdBigInt);
      if (!authUser) {
        throw new UnauthorizedError('User account not found');
      }
      if (authUser.status !== 'ACTIVE') {
        throw new UnauthorizedError(`Account is ${authUser.status.toLowerCase()}. Access denied`);
      }
      if (authUser.passwordLastChangedAt && decoded.iat) {
        const passwordChangedAtSeconds = Math.floor(new Date(authUser.passwordLastChangedAt).getTime() / 1000);
        if (decoded.iat < passwordChangedAtSeconds) {
          throw new UnauthorizedError('Session expired due to a recent password change. Please log in again.');
        }
      }
    }

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

export const requireAnyPermission = (...allowedPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (req.user.roles.includes('SUPER_ADMIN')) {
      return next();
    }

    const hasAny = allowedPermissions.some((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasAny) {
      return next(
        new ForbiddenError(
          `Insufficient permissions. Required one of: [${allowedPermissions.join(', ')}]`
        )
      );
    }

    next();
  };
};

export interface AccessOptions {
  roles?: string[];
  permissions?: string[];
}

export const requireAccess = (options: AccessOptions) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // SUPER_ADMIN always has full platform access
    if (req.user.roles.includes('SUPER_ADMIN')) {
      return next();
    }

    // Check matching roles if specified
    if (options.roles && options.roles.length > 0) {
      if (req.user.roles.some((role) => options.roles!.includes(role))) {
        return next();
      }
    }

    // Check matching permissions if specified
    if (options.permissions && options.permissions.length > 0) {
      if (req.user.permissions.some((perm) => options.permissions!.includes(perm))) {
        return next();
      }
    }

    return next(
      new ForbiddenError('Insufficient permissions to perform this action')
    );
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

export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;
    const cookieName = getPortalCookieName(req);

    // 1. Prefer explicit Authorization header sent by client SPA
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    } else if (req.cookies && req.cookies[cookieName]) {
      token = req.cookies[cookieName];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next();
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    } catch {
      // If cookie token failed, check if client also sent Authorization header
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const headerToken = req.headers.authorization.substring(7);
        try {
          decoded = jwt.verify(headerToken, config.JWT_SECRET) as JwtPayload;
        } catch {
          return next();
        }
      } else {
        return next();
      }
    }
    const userIdBigInt = BigInt(decoded.userId);

    if (decoded.roles && decoded.roles.includes('CUSTOMER')) {
      const customer = await authRepository.findCustomerById(userIdBigInt);
      if (customer && customer.Status === 'ACTIVE') {
        req.user = {
          userId: String(customer.CustomerID),
          email: customer.Email || '',
          firstName: customer.FirstName,
          lastName: customer.LastName,
          status: customer.Status,
          roles: ['CUSTOMER'],
          permissions: [],
          sellers: [],
          warehouses: [],
        };
      }
    } else {
      const authUser = await authRepository.getUserAuthContext(userIdBigInt);
      if (authUser && authUser.status === 'ACTIVE') {
        req.user = authUser;
      }
    }
    return next();
  } catch {
    return next();
  }
};

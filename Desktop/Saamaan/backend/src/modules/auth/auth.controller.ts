import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { loginSchema, changePasswordSchema, sellerRegisterSchema } from './auth.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { config } from '../../config/index.js';
import { getPortalCookieName } from '../../utils/portalCookie.js';
import { getPortalRefreshTokenCookieName } from '../../utils/token.js';
import { UnauthorizedError } from '../../utils/errors.js';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const cookieName = getPortalCookieName(req);
      const refreshCookieName = getPortalRefreshTokenCookieName(req);
      const isCustomer = cookieName === 'customer_token';
      const meta = { ip: req.ip || req.socket.remoteAddress, userAgent: req.headers['user-agent'] };

      // If logging in from customer portal, authenticate exclusively against Customers table
      const result = isCustomer
        ? await authService.customerLogin(
            {
              identifier: (validated as any).identifier || validated.email,
              password: validated.password,
            },
            meta
          )
        : await authService.login(validated, meta);

      // Access Token Cookie (1 hour for customer, 15 minutes for staff)
      const accessMaxAge = isCustomer ? 60 * 60 * 1000 : 15 * 60 * 1000;
      res.cookie(cookieName, result.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: accessMaxAge,
        path: '/',
      });

      // Refresh Token Cookie (30 days for customer, 7 days for staff)
      const refreshMaxAge = isCustomer
        ? config.CUSTOMER_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
        : config.STAFF_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000;
      res.cookie(refreshCookieName, result.refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: refreshMaxAge,
        path: '/',
      });

      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async sellerRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = sellerRegisterSchema.parse(req.body);
      const meta = { ip: req.ip || req.socket.remoteAddress, userAgent: req.headers['user-agent'] };
      const result = await authService.sellerRegister(validated, meta);
      const cookieName = getPortalCookieName(req);
      const refreshCookieName = getPortalRefreshTokenCookieName(req);

      // Staff Access Token: 15 minutes
      res.cookie(cookieName, result.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      // Staff Refresh Token: 7 days
      res.cookie(refreshCookieName, result.refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: config.STAFF_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
        path: '/',
      });

      sendSuccess(res, result, 'Seller registered successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async customerRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { customerRegisterSchema } = await import('./auth.validation.js');
      const validated = customerRegisterSchema.parse(req.body);
      const meta = { ip: req.ip || req.socket.remoteAddress, userAgent: req.headers['user-agent'] };
      const result = await authService.customerRegister(validated, meta);
      const cookieName = getPortalCookieName(req);
      const refreshCookieName = getPortalRefreshTokenCookieName(req);

      // Customer Access Token: 1 hour
      res.cookie(cookieName, result.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 60 * 60 * 1000,
        path: '/',
      });

      // Customer Refresh Token: 30 days
      res.cookie(refreshCookieName, result.refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: config.CUSTOMER_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
        path: '/',
      });

      sendSuccess(res, result, 'Customer account created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookieName = getPortalCookieName(req);
      const refreshCookieName = getPortalRefreshTokenCookieName(req);
      const isCustomer = cookieName === 'customer_token';

      // Accept refresh token from cookie, Authorization header, X-Refresh-Token header, or body
      let rawRefreshToken: string | undefined = req.cookies?.[refreshCookieName] || req.body?.refreshToken;
      if (!rawRefreshToken && req.headers['x-refresh-token']) {
        rawRefreshToken = req.headers['x-refresh-token'] as string;
      }

      if (!rawRefreshToken) {
        throw new UnauthorizedError('Refresh token is required');
      }

      const meta = {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const result = isCustomer
        ? await authService.refreshCustomerSession(rawRefreshToken, meta)
        : await authService.refreshStaffSession(rawRefreshToken, meta);

      // Set fresh access token cookie
      const accessMaxAge = isCustomer ? 60 * 60 * 1000 : 15 * 60 * 1000;
      res.cookie(cookieName, result.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: accessMaxAge,
        path: '/',
      });

      // Set rotated refresh token cookie (sliding expiration for customer: 30d; staff: 7d)
      const refreshMaxAge = isCustomer
        ? config.CUSTOMER_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
        : config.STAFF_REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000;

      res.cookie(refreshCookieName, result.refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: refreshMaxAge,
        path: '/',
      });

      sendSuccess(res, result, 'Session refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookieName = getPortalCookieName(req);
      const refreshCookieName = getPortalRefreshTokenCookieName(req);
      const isCustomer = cookieName === 'customer_token';

      const rawRefreshToken =
        req.cookies?.[refreshCookieName] ||
        req.body?.refreshToken ||
        (req.headers['x-refresh-token'] as string | undefined);

      await authService.logout(rawRefreshToken, isCustomer);

      // Clear both access token and refresh token cookies
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/',
      });
      res.clearCookie(refreshCookieName, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/',
      });

      sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { forgotPasswordSchema } = await import('./auth.validation.js');
      const validated = forgotPasswordSchema.parse(req.body);
      const isCustomer = getPortalCookieName(req) === 'customer_token';
      const result = await authService.forgotPassword(validated, isCustomer);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resetPasswordSchema } = await import('./auth.validation.js');
      const validated = resetPasswordSchema.parse(req.body);
      const isCustomer = getPortalCookieName(req) === 'customer_token';
      const result = await authService.resetPassword(validated, isCustomer);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await authService.getProfile(req.user!.userId);
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = changePasswordSchema.parse(req.body);
      await authService.changePassword(req.user!.userId, validated);
      sendSuccess(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  async adminForceReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetUserId } = req.body;
      if (!targetUserId) throw new Error('Target user ID is required');
      await authService.adminForceReset(targetUserId);
      sendSuccess(res, null, 'User session invalidated and password reset initiated');
    } catch (error) {
      next(error);
    }
  }

  async listUsersForAdmin(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await authService.listUsersForAdmin();
      sendSuccess(res, users);
    } catch (error) {
      next(error);
    }
  }

  async listRolesForAdmin(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await authService.listRolesForAdmin();
      sendSuccess(res, roles);
    } catch (error) {
      next(error);
    }
  }

  async listAllPermissions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const permissions = await authService.listAllPermissions();
      sendSuccess(res, permissions);
    } catch (error) {
      next(error);
    }
  }

  async createRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleName, description, permissionCodes } = req.body;
      const adminUserId = req.user?.userId ? BigInt(req.user.userId) : undefined;
      const role = await authService.createRole({ roleName, description, permissionCodes }, adminUserId);
      sendSuccess(res, role, 'Role created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getRoleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleId } = req.params;
      const role = await authService.getRoleById(roleId);
      sendSuccess(res, role);
    } catch (error) {
      next(error);
    }
  }

  async getRolePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleId } = req.params;
      const permissions = await authService.getRolePermissions(roleId);
      sendSuccess(res, permissions);
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleId } = req.params;
      const { description, permissionCodes, status } = req.body;
      await authService.updateRole(roleId, { description, permissionCodes, status });
      sendSuccess(res, null, 'Role updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateRoleDescription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleId } = req.params;
      const { description } = req.body;
      await authService.updateRoleDescription(roleId, description);
      sendSuccess(res, null, 'Role description updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { status } = req.body;
      if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
        throw new Error('Valid status (ACTIVE or INACTIVE) is required.');
      }
      await authService.updateUserStatus(userId, status, req.user!.userId);
      sendSuccess(res, null, `User status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  }

  async updateUserRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { roles } = req.body;
      await authService.updateUserRoles(userId, roles, req.user!.userId);
      sendSuccess(res, null, 'User roles updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async createInternalUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.createInternalUser(req.body, req.user!.userId);
      sendSuccess(res, result, result.message, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { loginSchema, changePasswordSchema, sellerRegisterSchema } from './auth.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { config } from '../../config/index.js';
import { getPortalCookieName } from '../../utils/portalCookie.js';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const cookieName = getPortalCookieName(req);

      // If logging in from customer portal, authenticate exclusively against Customers table
      const result = cookieName === 'customer_token'
        ? await authService.customerLogin(validated)
        : await authService.login(validated);

      // Set httpOnly secure cookie for the specific portal
      res.cookie(cookieName, result.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
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
      const result = await authService.sellerRegister(validated);
      const cookieName = getPortalCookieName(req);

      // Set httpOnly secure cookie for the seller portal
      res.cookie(cookieName, result.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
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
      const result = await authService.customerRegister(validated);
      const cookieName = getPortalCookieName(req);

      res.cookie(cookieName, result.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      });

      sendSuccess(res, result, 'Customer account created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { forgotPasswordSchema } = await import('./auth.validation.js');
      const validated = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(validated);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resetPasswordSchema } = await import('./auth.validation.js');
      const validated = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(validated);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookieName = getPortalCookieName(req);
      res.clearCookie(cookieName, {
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
}

export const authController = new AuthController();

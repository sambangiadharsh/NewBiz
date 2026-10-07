import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', (req, res, next) => authController.login(req, res, next));
authRouter.post('/register', (req, res, next) => authController.customerRegister(req, res, next));
authRouter.post('/forgot-password', (req, res, next) => authController.forgotPassword(req, res, next));
authRouter.post('/reset-password', (req, res, next) => authController.resetPassword(req, res, next));
authRouter.post('/seller/register', (req, res, next) => authController.sellerRegister(req, res, next));
authRouter.post('/logout', (req, res, next) => authController.logout(req, res, next));
authRouter.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));
authRouter.post('/change-password', authenticate, (req, res, next) =>
  authController.changePassword(req, res, next)
);
authRouter.post('/admin/force-reset', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), (req, res, next) =>
  authController.adminForceReset(req, res, next)
);
authRouter.get('/admin/users', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), (req, res, next) =>
  authController.listUsersForAdmin(req, res, next)
);
authRouter.get('/admin/roles', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), (req, res, next) =>
  authController.listRolesForAdmin(req, res, next)
);
authRouter.patch('/admin/roles/:roleId', authenticate, requireRoles('SUPER_ADMIN'), (req, res, next) =>
  authController.updateRoleDescription(req, res, next)
);
authRouter.patch('/admin/users/:userId/status', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), (req, res, next) =>
  authController.updateUserStatus(req, res, next)
);
authRouter.patch('/admin/users/:userId/roles', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), (req, res, next) =>
  authController.updateUserRoles(req, res, next)
);
authRouter.post('/admin/users', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), (req, res, next) =>
  authController.createInternalUser(req, res, next)
);

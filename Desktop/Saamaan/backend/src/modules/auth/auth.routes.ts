import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate, requirePermissions, requireAnyPermission } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';

export const authRouter = Router();

authRouter.post('/login', (req, res, next) => authController.login(req, res, next));
authRouter.post('/register', (req, res, next) => authController.customerRegister(req, res, next));
authRouter.post('/forgot-password', (req, res, next) => authController.forgotPassword(req, res, next));
authRouter.post('/reset-password', (req, res, next) => authController.resetPassword(req, res, next));
authRouter.post('/seller/register', (req, res, next) => authController.sellerRegister(req, res, next));
authRouter.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
authRouter.post('/logout', (req, res, next) => authController.logout(req, res, next));
authRouter.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));
authRouter.post('/change-password', authenticate, (req, res, next) =>
  authController.changePassword(req, res, next)
);
authRouter.post(
  '/admin/force-reset',
  authenticate,
  requirePermissions(PERMISSIONS.USERS_MANAGE),
  (req, res, next) => authController.adminForceReset(req, res, next)
);
authRouter.get(
  '/admin/users',
  authenticate,
  requireAnyPermission(PERMISSIONS.USERS_READ, PERMISSIONS.USERS_MANAGE),
  (req, res, next) => authController.listUsersForAdmin(req, res, next)
);
authRouter.get(
  '/admin/roles',
  authenticate,
  requireAnyPermission(PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_READ),
  (req, res, next) => authController.listRolesForAdmin(req, res, next)
);
authRouter.get(
  '/admin/permissions',
  authenticate,
  requireAnyPermission(PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_READ),
  (req, res, next) => authController.listAllPermissions(req, res, next)
);
authRouter.post(
  '/admin/roles',
  authenticate,
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
  (req, res, next) => authController.createRole(req, res, next)
);
authRouter.get(
  '/admin/roles/:roleId',
  authenticate,
  requireAnyPermission(PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_READ),
  (req, res, next) => authController.getRoleById(req, res, next)
);
authRouter.get(
  '/admin/roles/:roleId/permissions',
  authenticate,
  requireAnyPermission(PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_READ),
  (req, res, next) => authController.getRolePermissions(req, res, next)
);
authRouter.put(
  '/admin/roles/:roleId',
  authenticate,
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
  (req, res, next) => authController.updateRole(req, res, next)
);
authRouter.patch(
  '/admin/roles/:roleId',
  authenticate,
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
  (req, res, next) => authController.updateRole(req, res, next)
);
authRouter.patch(
  '/admin/users/:userId/status',
  authenticate,
  requirePermissions(PERMISSIONS.USERS_MANAGE),
  (req, res, next) => authController.updateUserStatus(req, res, next)
);
authRouter.patch(
  '/admin/users/:userId/roles',
  authenticate,
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
  (req, res, next) => authController.updateUserRoles(req, res, next)
);
authRouter.post(
  '/admin/users',
  authenticate,
  requirePermissions(PERMISSIONS.USERS_MANAGE),
  (req, res, next) => authController.createInternalUser(req, res, next)
);

import { Router } from 'express';
import { authenticate, requireAccess } from '../../middleware/auth.js';
import { policiesController } from './policies.controller.js';

export const publicPoliciesRouter = Router();
export const adminPoliciesRouter = Router();

// Public routes (useful for active policy lookups on storefront/sellers)
publicPoliciesRouter.get('/returns', (req, res, next) =>
  policiesController.listReturnPolicies(req, res, next)
);
publicPoliciesRouter.get('/returns/:id', (req, res, next) =>
  policiesController.getReturnPolicyById(req, res, next)
);

// Admin routes for policy management
adminPoliciesRouter.use(
  authenticate,
  requireAccess({
    roles: ['SUPER_ADMIN', 'ADMIN'],
    permissions: ['catalog.read', 'catalog.manage'],
  })
);

// Return policies
adminPoliciesRouter.get('/returns', (req, res, next) =>
  policiesController.listReturnPolicies(req, res, next)
);
adminPoliciesRouter.get('/returns/:id', (req, res, next) =>
  policiesController.getReturnPolicyById(req, res, next)
);
adminPoliciesRouter.post('/returns', (req, res, next) =>
  policiesController.createReturnPolicy(req, res, next)
);
adminPoliciesRouter.put('/returns/:id', (req, res, next) =>
  policiesController.updateReturnPolicy(req, res, next)
);
adminPoliciesRouter.patch('/returns/:id/status', (req, res, next) =>
  policiesController.toggleReturnPolicyStatus(req, res, next)
);

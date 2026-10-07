import { Router } from 'express';
import { authenticate, requireRoles } from '../../middleware/auth.js';
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
publicPoliciesRouter.get('/warranties', (req, res, next) =>
  policiesController.listWarrantyPolicies(req, res, next)
);
publicPoliciesRouter.get('/warranties/:id', (req, res, next) =>
  policiesController.getWarrantyPolicyById(req, res, next)
);

// Admin-only routes for management
adminPoliciesRouter.use(authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'));

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

// Warranty policies
adminPoliciesRouter.get('/warranties', (req, res, next) =>
  policiesController.listWarrantyPolicies(req, res, next)
);
adminPoliciesRouter.get('/warranties/:id', (req, res, next) =>
  policiesController.getWarrantyPolicyById(req, res, next)
);
adminPoliciesRouter.post('/warranties', (req, res, next) =>
  policiesController.createWarrantyPolicy(req, res, next)
);
adminPoliciesRouter.put('/warranties/:id', (req, res, next) =>
  policiesController.updateWarrantyPolicy(req, res, next)
);
adminPoliciesRouter.patch('/warranties/:id/status', (req, res, next) =>
  policiesController.toggleWarrantyPolicyStatus(req, res, next)
);

import { Router } from 'express';
import { customerAddressesController } from './addresses.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';

export const customerAddressesRouter = Router();

// Pincode lookup endpoint (accessible without login or with login for checkout auto-fill)
customerAddressesRouter.get('/pincode/:pincode', (req, res, next) => customerAddressesController.lookupPincode(req, res, next));

// Protect customer-specific address endpoints
customerAddressesRouter.use(authenticate, requireRoles('CUSTOMER'));

customerAddressesRouter.get('/', (req, res, next) => customerAddressesController.list(req, res, next));
customerAddressesRouter.post('/', (req, res, next) => customerAddressesController.create(req, res, next));
customerAddressesRouter.patch('/:id/default', (req, res, next) => customerAddressesController.setDefault(req, res, next));
customerAddressesRouter.delete('/:id', (req, res, next) => customerAddressesController.delete(req, res, next));

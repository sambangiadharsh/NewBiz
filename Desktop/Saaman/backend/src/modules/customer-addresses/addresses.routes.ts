import { Router } from 'express';
import { customerAddressesController } from './addresses.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';

export const customerAddressesRouter = Router();

// Protect all customer address endpoints
customerAddressesRouter.use(authenticate, requireRoles('CUSTOMER'));

customerAddressesRouter.get('/', (req, res, next) => customerAddressesController.list(req, res, next));
customerAddressesRouter.post('/', (req, res, next) => customerAddressesController.create(req, res, next));
customerAddressesRouter.patch('/:id/default', (req, res, next) => customerAddressesController.setDefault(req, res, next));
customerAddressesRouter.delete('/:id', (req, res, next) => customerAddressesController.delete(req, res, next));

import { Router } from 'express';
import { cartController } from './cart.controller.js';
import { optionalAuthenticate } from '../../middleware/auth.js';

export const customerCartRouter = Router();

// Allow authenticated customers or guest customers
customerCartRouter.use(optionalAuthenticate);

customerCartRouter.get('/', (req, res, next) => cartController.getCart(req, res, next));
customerCartRouter.post('/items', (req, res, next) => cartController.addItem(req, res, next));
customerCartRouter.patch('/items/:id', (req, res, next) => cartController.updateQuantity(req, res, next));
customerCartRouter.delete('/items/:id', (req, res, next) => cartController.removeItem(req, res, next));
customerCartRouter.delete('/clear', (req, res, next) => cartController.clearCart(req, res, next));
customerCartRouter.post('/merge', (req, res, next) => cartController.mergeCart(req, res, next));

import { Router } from 'express';
import { wishlistController } from './wishlist.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';

export const customerWishlistRouter = Router();

// All wishlist actions require customer authentication
customerWishlistRouter.use(authenticate, requireRoles('CUSTOMER'));

customerWishlistRouter.get('/', (req, res, next) => wishlistController.getWishlist(req, res, next));
customerWishlistRouter.post('/items', (req, res, next) => wishlistController.addItem(req, res, next));
customerWishlistRouter.delete('/items/:id', (req, res, next) => wishlistController.removeItem(req, res, next));

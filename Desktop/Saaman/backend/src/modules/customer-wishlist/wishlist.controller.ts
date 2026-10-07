import { Request, Response, NextFunction } from 'express';
import { wishlistService } from './wishlist.service.js';
import { sendSuccess } from '../../utils/response.js';
import { UnauthorizedError } from '../../utils/errors.js';

export class WishlistController {
  async getWishlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        throw new UnauthorizedError('Authentication required');
      }
      const items = await wishlistService.getWishlist(req.user.userId);
      sendSuccess(res, items, 'Wishlist retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        throw new UnauthorizedError('Authentication required');
      }
      const productId = req.body.productId || req.body.productVariantId;
      const items = await wishlistService.addItem(req.user.userId, String(productId));
      sendSuccess(res, items, 'Item added to wishlist', 201);
    } catch (error) {
      next(error);
    }
  }

  async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        throw new UnauthorizedError('Authentication required');
      }
      const { id } = req.params;
      const items = await wishlistService.removeItem(req.user.userId, id);
      sendSuccess(res, items, 'Item removed from wishlist');
    } catch (error) {
      next(error);
    }
  }
}

export const wishlistController = new WishlistController();

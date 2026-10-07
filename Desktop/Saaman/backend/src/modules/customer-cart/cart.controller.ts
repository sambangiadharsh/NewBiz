import { Request, Response, NextFunction } from 'express';
import { cartService } from './cart.service.js';
import { sendSuccess } from '../../utils/response.js';
import { UnauthorizedError } from '../../utils/errors.js';

export class CartController {
  async getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authentication required');
      }
      const cart = await cartService.getCart(req.user.userId);
      sendSuccess(res, cart, 'Cart retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authentication required');
      }
      const { sellerProductId, productVariantId, productId, quantity } = req.body;
      const cart = await cartService.addItem(req.user.userId, {
        sellerProductId,
        productVariantId,
        productId,
        quantity: Number(quantity) || 1,
      });
      sendSuccess(res, cart, 'Item added to cart', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateQuantity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authentication required');
      }
      const { id } = req.params;
      const { quantity } = req.body;
      const cart = await cartService.updateQuantity(req.user.userId, id, Number(quantity));
      sendSuccess(res, cart, 'Cart updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authentication required');
      }
      const { id } = req.params;
      const cart = await cartService.removeItem(req.user.userId, id);
      sendSuccess(res, cart, 'Item removed from cart');
    } catch (error) {
      next(error);
    }
  }

  async clearCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authentication required');
      }
      const cart = await cartService.clearCart(req.user.userId);
      sendSuccess(res, cart, 'Cart cleared successfully');
    } catch (error) {
      next(error);
    }
  }

  async mergeCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authentication required');
      }
      const { items } = req.body;
      const cart = await cartService.mergeCart(req.user.userId, items || []);
      sendSuccess(res, cart, 'Cart merged successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const cartController = new CartController();

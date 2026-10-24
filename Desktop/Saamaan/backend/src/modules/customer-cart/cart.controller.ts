import { Request, Response, NextFunction } from 'express';
import { cartService } from './cart.service.js';
import { sendSuccess } from '../../utils/response.js';
import { getPool, sql } from '../../database/db.js';

export class CartController {
  private async resolveCustomerId(req: Request): Promise<string> {
    if (req.user?.userId && req.user.roles?.includes('CUSTOMER')) {
      return req.user.userId;
    }

    const guestHeader = (req.headers['x-guest-customer-id'] as string) || 'guest_default';
    const pool = await getPool();
    const guestEmail = `${guestHeader.toLowerCase().replace(/[^a-z0-9_]/g, '')}@guest.saaman.shop`;

    const existing = await pool
      .request()
      .input('email', sql.NVarChar, guestEmail)
      .query<{ CustomerID: bigint }>(`
        SELECT TOP 1 CustomerID FROM dbo.Customers WHERE Email = @email
      `);

    if (existing.recordset.length > 0) {
      return String(existing.recordset[0].CustomerID);
    }

    const created = await pool
      .request()
      .input('fn', sql.NVarChar, 'Guest')
      .input('ln', sql.NVarChar, 'Shopper')
      .input('email', sql.NVarChar, guestEmail)
      .query<{ CustomerID: bigint }>(`
        INSERT INTO dbo.Customers (FirstName, LastName, Email, Status, CreatedAt)
        OUTPUT INSERTED.CustomerID
        VALUES (@fn, @ln, @email, 'ACTIVE', SYSUTCDATETIME())
      `);

    return String(created.recordset[0].CustomerID);
  }

  async getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = await this.resolveCustomerId(req);
      const cart = await cartService.getCart(customerId);
      sendSuccess(res, cart, 'Cart retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = await this.resolveCustomerId(req);
      const { sellerProductId, productVariantId, productId, quantity } = req.body;
      const cart = await cartService.addItem(customerId, {
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
      const customerId = await this.resolveCustomerId(req);
      const { id } = req.params;
      const { quantity } = req.body;
      const cart = await cartService.updateQuantity(customerId, id, Number(quantity));
      sendSuccess(res, cart, 'Cart updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = await this.resolveCustomerId(req);
      const { id } = req.params;
      const cart = await cartService.removeItem(customerId, id);
      sendSuccess(res, cart, 'Item removed from cart');
    } catch (error) {
      next(error);
    }
  }

  async clearCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = await this.resolveCustomerId(req);
      const cart = await cartService.clearCart(customerId);
      sendSuccess(res, cart, 'Cart cleared successfully');
    } catch (error) {
      next(error);
    }
  }

  async mergeCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = await this.resolveCustomerId(req);
      const { items } = req.body;
      const cart = await cartService.mergeCart(customerId, items || []);
      sendSuccess(res, cart, 'Cart merged successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const cartController = new CartController();


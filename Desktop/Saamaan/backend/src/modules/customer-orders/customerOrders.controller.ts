import { Request, Response, NextFunction } from 'express';
import { customerOrdersService } from './customerOrders.service.js';
import { sendSuccess } from '../../utils/response.js';
import { UnauthorizedError, BadRequestError } from '../../utils/errors.js';

export class CustomerOrdersController {
  private getCustomerId(req: Request): bigint | null {
    const customerId = req.user?.userId;
    return customerId ? BigInt(customerId) : null;
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      if (!customerId) {
        throw new UnauthorizedError('Please log in to your account to place an order.');
      }

      const {
        shippingAddressId,
        rawAddress,
        paymentModeCode,
        couponCode,
        items,
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new BadRequestError('At least one item is required in the order.');
      }

      const result = await customerOrdersService.placeOrder({
        customerId,
        shippingAddressId,
        rawAddress,
        paymentModeCode: paymentModeCode || 'COD',
        couponCode,
        items,
      });

      sendSuccess(res, result, 'Order placed successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      if (!customerId) {
        throw new UnauthorizedError('Authentication required to view orders.');
      }

      const orders = await customerOrdersService.getCustomerOrders(customerId);
      sendSuccess(res, orders, 'Orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async downloadInvoicePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      if (!customerId) {
        throw new UnauthorizedError('Authentication required to download invoice.');
      }

      const orderId = BigInt(req.params.orderId);
      const { buffer, invoiceNumber } = await customerOrdersService.getInvoicePdf(customerId, orderId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber || `Invoice-${orderId}`}.pdf"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (error) {
      next(error);
    }
  }
}

export const customerOrdersController = new CustomerOrdersController();

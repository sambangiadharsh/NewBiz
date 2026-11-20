import { Request, Response, NextFunction } from 'express';
import { customerOrdersService } from './customerOrders.service.js';
import { processAndSaveReturnProofImage } from './returnProof.upload.js';
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

  async submitReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      if (!customerId) {
        throw new UnauthorizedError('Authentication required to submit return request.');
      }

      const {
        orderItemId,
        requestType,
        reasonCategory,
        reasonDescription,
        quantity,
        resolutionType,
        refundMethod,
        refundDetails,
        pickupAddress,
        images,
      } = req.body;

      if (!orderItemId) {
        throw new BadRequestError('orderItemId is required.');
      }
      if (!requestType || !['RETURN', 'REPLACEMENT'].includes(requestType)) {
        throw new BadRequestError('requestType must be either "RETURN" or "REPLACEMENT".');
      }
      if (!reasonCategory) {
        throw new BadRequestError('reasonCategory is required.');
      }

      const result = await customerOrdersService.submitReturnRequest({
        customerId,
        orderItemId: BigInt(orderItemId),
        requestType,
        reasonCategory,
        reasonDescription,
        quantity: quantity ? Number(quantity) : 1,
        resolutionType,
        refundMethod,
        refundDetails,
        pickupAddress,
        images,
      });

      sendSuccess(res, result, 'Return/Replacement request submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async listReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      if (!customerId) {
        throw new UnauthorizedError('Authentication required.');
      }

      const returns = await customerOrdersService.getCustomerReturnRequests(customerId);
      sendSuccess(res, returns, 'Return requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadProof(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      if (!customerId) {
        throw new UnauthorizedError('Authentication required to upload proof images.');
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        sendSuccess(res, { urls: [] }, 'No proof images provided');
        return;
      }

      const urls: string[] = [];
      for (const file of files) {
        const url = await processAndSaveReturnProofImage(file);
        urls.push(url);
      }

      sendSuccess(res, { urls }, 'Proof images processed and uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancelReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getCustomerId(req);
      if (!customerId) {
        throw new UnauthorizedError('Authentication required.');
      }

      const returnRequestId = BigInt(req.params.returnRequestId);
      const result = await customerOrdersService.cancelReturnRequest(customerId, returnRequestId);
      sendSuccess(res, result, 'Return request cancelled successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const customerOrdersController = new CustomerOrdersController();

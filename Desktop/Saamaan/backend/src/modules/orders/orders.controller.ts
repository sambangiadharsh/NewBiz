import { Request, Response } from 'express';
import { ordersService } from './orders.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export class OrdersController {
  private getSellerId(req: Request): bigint {
    const sellerId = (req as any).user?.sellers?.[0]?.sellerId || (req as any).sellerContext?.sellerId;
    if (!sellerId) {
      throw new Error('User is not associated with an active seller profile');
    }
    return BigInt(sellerId);
  }

  async getSummary(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const summary = await ordersService.getSummary(sellerId);
      return sendSuccess(res, summary, 'Orders summary fetched successfully');
    } catch (err: any) {
      return sendError(res, 'FETCH_ORDERS_SUMMARY_ERROR', err.message || 'Failed to fetch orders summary', 500);
    }
  }

  async getList(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const { status, search, page, limit } = req.query;

      const list = await ordersService.getList(sellerId, {
        status: status as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      return sendSuccess(res, list, 'Orders fetched successfully');
    } catch (err: any) {
      return sendError(res, 'FETCH_ORDERS_ERROR', err.message || 'Failed to fetch orders', 500);
    }
  }

  async getDetail(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const { id } = req.params;

      const order = await ordersService.getDetail(sellerId, BigInt(id));
      return sendSuccess(res, order, 'Order details fetched successfully');
    } catch (err: any) {
      return sendError(res, 'ORDER_NOT_FOUND', err.message || 'Failed to fetch order details', 404);
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return sendError(res, 'VALIDATION_ERROR', 'New status is required', 400);
      }

      const result = await ordersService.updateStatus(sellerId, BigInt(id), status);
      return sendSuccess(res, result, 'Order status updated successfully');
    } catch (err: any) {
      return sendError(res, 'UPDATE_STATUS_ERROR', err.message || 'Failed to update order status', 400);
    }
  }

  async dispatchShipment(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const { id } = req.params;
      const { carrier, trackingNumber, packageWeight, estimatedDeliveryDate } = req.body;

      const result = await ordersService.dispatchShipment(sellerId, BigInt(id), {
        carrier,
        trackingNumber,
        packageWeight: packageWeight ? parseFloat(packageWeight) : undefined,
        estimatedDeliveryDate,
      });

      return sendSuccess(res, result, 'Shipment dispatched and tracking updated successfully');
    } catch (err: any) {
      return sendError(res, 'DISPATCH_ERROR', err.message || 'Failed to dispatch shipment', 400);
    }
  }

  async downloadInvoicePdf(req: Request, res: Response) {
    try {
      const sellerId = this.getSellerId(req);
      const { id } = req.params;

      const { buffer, invoiceNumber } = await ordersService.getInvoicePdf(sellerId, BigInt(id));

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    } catch (err: any) {
      return sendError(res, 'INVOICE_PDF_ERROR', err.message || 'Failed to generate invoice PDF', 500);
    }
  }
}

export const ordersController = new OrdersController();

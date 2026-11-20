import { Request, Response, NextFunction } from 'express';
import { adminOrdersService } from './adminOrders.service.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { UnauthorizedError } from '../../utils/errors.js';

export class AdminOrdersController {
  async getSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await adminOrdersService.getSummary();
      return sendSuccess(res, summary, 'Orders summary fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getList(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, startDate, endDate } = req.query;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await adminOrdersService.getOrdersList({
        search: search as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page,
        limit,
      });

      return sendPaginated(
        res,
        result.items,
        result.pagination.page,
        result.pagination.limit,
        result.pagination.total,
        'Master orders fetched successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async exportOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, startDate, endDate } = req.query;
      await adminOrdersService.exportOrdersXlsx(res, {
        search: search as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const detail = await adminOrdersService.getOrderDetail(req.params.id);
      return sendSuccess(res, detail, 'Order detail fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getFulfillments(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, warehouseId } = req.query;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await adminOrdersService.getFulfillmentsList({
        search: search as string,
        status: status as string,
        warehouseId: warehouseId as string,
        page,
        limit,
      });

      return sendPaginated(
        res,
        result.items,
        result.pagination.page,
        result.pagination.limit,
        result.pagination.total,
        'Fulfillments fetched successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status } = req.query;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await adminOrdersService.getPaymentsList({
        search: search as string,
        status: status as string,
        page,
        limit,
      });

      return sendPaginated(
        res,
        result.items,
        result.pagination.page,
        result.pagination.limit,
        result.pagination.total,
        'Payments fetched successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getCancelled(req: Request, res: Response, next: NextFunction) {
    try {
      const { search } = req.query;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await adminOrdersService.getCancelledOrdersList({
        search: search as string,
        page,
        limit,
      });

      return sendPaginated(
        res,
        result.items,
        result.pagination.page,
        result.pagination.limit,
        result.pagination.total,
        'Cancelled orders fetched successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        throw new UnauthorizedError('User authentication context missing');
      }

      const { reason } = req.body;
      const result = await adminOrdersService.cancelOrder(
        req.params.id,
        reason,
        BigInt(adminUserId)
      );

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async getReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status } = req.query;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await adminOrdersService.getReturnsList({
        search: search as string,
        status: status as string,
        page,
        limit,
      });

      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
        summary: result.summary,
        message: 'Return requests fetched successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateReturnStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        throw new UnauthorizedError('User authentication context missing');
      }

      const {
        status,
        adminComments,
        trackingNumber,
        qcStatus,
        qcNotes,
        qcGrade,
        refundTransactionId,
        replacementOrderId,
        restockInventory,
      } = req.body;
      const result = await adminOrdersService.updateReturnStatus({
        returnRequestIdStr: req.params.returnRequestId,
        status,
        adminComments,
        trackingNumber,
        qcStatus,
        qcNotes,
        qcGrade,
        refundTransactionId,
        replacementOrderId: replacementOrderId ? BigInt(replacementOrderId) : undefined,
        restockInventory: restockInventory !== undefined ? Boolean(restockInventory) : undefined,
        adminUserId: BigInt(adminUserId),
      });

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const adminOrdersController = new AdminOrdersController();

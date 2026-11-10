import { Request, Response } from 'express';
import { paymentsService } from './payments.service.js';
import { BadRequestError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export class PaymentsController {
  /**
   * POST /api/v1/payments/initiate
   * Initiates payment order with the active gateway (PhonePe v2)
   */
  async initiate(req: Request, res: Response): Promise<void> {
    const { orderId, customerId: bodyCustomerId } = req.body;

    if (!orderId) {
      throw new BadRequestError('orderId is required');
    }

    let customerId = req.user?.userId || bodyCustomerId;
    if (!customerId) {
      customerId = await paymentsService.getCustomerIdForOrder(orderId);
    }

    if (!customerId) {
      throw new BadRequestError('customerId is required to initiate payment');
    }

    const result = await paymentsService.initiatePayment({
      orderId,
      customerId,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * GET /api/v1/payments/verify/:orderId
   * Synchronous return verification (Way 2)
   */
  async verify(req: Request, res: Response): Promise<void> {
    const { orderId } = req.params;
    const { txnId, customerId: queryCustomerId } = req.query;

    if (!orderId) {
      throw new BadRequestError('orderId is required');
    }

    const customerId = req.user?.userId || (queryCustomerId as string | undefined);

    // If neither customer identity nor txnId is provided, reject request
    if (!customerId && !txnId) {
      throw new BadRequestError('Either customer identity or transaction ID (txnId) is required to verify payment');
    }

    const result = await paymentsService.verifyPayment({
      orderId,
      merchantTransactionId: txnId as string | undefined,
      customerId,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * POST /api/v1/payments/webhook/phonepe
   * Server-to-Server asynchronous webhook callback (Way 1)
   */
  async phonepeWebhook(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Incoming PhonePe Webhook notification received', undefined, 'PaymentsWebhook');
      const result = await paymentsService.handleWebhook(req.headers, req.body);
      // PhonePe expects HTTP 200 to acknowledge receipt
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      logger.error('Error in PhonePe Webhook handler:', err, 'PaymentsWebhook');
      // Even if internal error happens, return 200 so PhonePe doesn't infinitely spam or drop connection
      res.status(200).json({
        success: false,
        error: err.message,
      });
    }
  }
}

export const paymentsController = new PaymentsController();

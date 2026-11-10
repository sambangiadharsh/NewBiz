import { getPool, sql } from '../../database/db.js';
import { logger } from '../../utils/logger.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { PaymentGatewayFactory } from './paymentGateway.factory.js';
import { config } from '../../config/index.js';

export interface InitiatePaymentInput {
  orderId: string | bigint;
  customerId: string | bigint;
}

export interface VerifyPaymentInput {
  orderId: string | bigint;
  merchantTransactionId?: string;
  customerId?: string | bigint;
}

export class PaymentsService {
  /**
   * Initiates an online checkout session with the active gateway (PhonePe v2)
   */
  async initiatePayment(input: InitiatePaymentInput) {
    const pool = await getPool();
    const orderId = BigInt(input.orderId);
    const customerId = BigInt(input.customerId);

    // 1. Validate Order exists and belongs to customer
    const orderRes = await pool
      .request()
      .input('orderId', sql.BigInt, orderId)
      .input('customerId', sql.BigInt, customerId)
      .query<{
        OrderID: bigint;
        OrderNumber: string;
        Status: string;
        TotalAmount: number;
        ShippingRecipientName: string;
        ShippingPhoneNumber: string | null;
      }>(`
        SELECT TOP 1 
          OrderID, OrderNumber, Status, TotalAmount,
          ShippingRecipientName, ShippingPhoneNumber
        FROM dbo.Orders
        WHERE OrderID = @orderId AND CustomerID = @customerId
      `);

    if (orderRes.recordset.length === 0) {
      throw new NotFoundError('Order not found or access denied.');
    }

    const order = orderRes.recordset[0];

    // If order is already confirmed or paid, prevent duplicate payment attempts
    if (order.Status?.toUpperCase() === 'CONFIRMED') {
      throw new BadRequestError('This order has already been paid and confirmed.');
    }
    if (order.Status?.toUpperCase() === 'CANCELLED' || order.Status?.toUpperCase() === 'EXPIRED') {
      throw new BadRequestError('This order has expired due to payment timeout (15m hold). Please place a new order.');
    }

    // 2. Resolve Customer Profile info
    const custRes = await pool
      .request()
      .input('customerId', sql.BigInt, customerId)
      .query<{ Email: string | null; PhoneNumber: string | null; FirstName: string | null; LastName: string | null }>(`
        SELECT TOP 1 Email, PhoneNumber, FirstName, LastName
        FROM dbo.Customers
        WHERE CustomerID = @customerId
      `);

    const customer = custRes.recordset[0] || {};
    const customerPhone = customer.PhoneNumber || order.ShippingPhoneNumber || undefined;
    const customerEmail = customer.Email || undefined;
    const customerFullName = customer.FirstName
      ? `${customer.FirstName} ${customer.LastName || ''}`.trim()
      : undefined;
    const customerName = customerFullName || order.ShippingRecipientName || undefined;

    // 3. Obtain Active Payment Gateway (PhonePe v2)
    const gateway = PaymentGatewayFactory.getGateway();

    // 4. Initiate payment with the gateway adapter
    const redirectBaseUrl = config.PHONEPE_REDIRECT_URL || 'http://localhost:7004/payment/callback';
    const initResult = await gateway.initiatePayment({
      orderId: order.OrderID,
      orderNumber: order.OrderNumber,
      amount: Number(order.TotalAmount),
      customerId,
      customerPhone,
      customerEmail,
      customerName,
      redirectUrl: redirectBaseUrl,
    });

    // 5. Upsert payment record in dbo.Payments
    const payRes = await pool
      .request()
      .input('orderId', sql.BigInt, orderId)
      .query<{ PaymentID: bigint }>(`
        SELECT TOP 1 PaymentID FROM dbo.Payments WHERE OrderID = @orderId ORDER BY PaymentID DESC
      `);

    const rawResponseStr = initResult.rawResponse ? JSON.stringify(initResult.rawResponse) : null;

    if (payRes.recordset.length > 0) {
      await pool
        .request()
        .input('paymentId', sql.BigInt, payRes.recordset[0].PaymentID)
        .input('gateway', sql.VarChar(50), gateway.providerName)
        .input('merchantTxnId', sql.NVarChar(100), initResult.merchantTransactionId)
        .input('rawJson', sql.NVarChar(sql.MAX), rawResponseStr)
        .query(`
          UPDATE dbo.Payments
          SET PaymentGateway = @gateway,
              MerchantTransactionID = @merchantTxnId,
              Status = 'PENDING',
              RawResponseJson = @rawJson,
              UpdatedAt = SYSUTCDATETIME()
          WHERE PaymentID = @paymentId
        `);
    } else {
      // Find PaymentModeID for ONLINE
      const modeRes = await pool.request().query<{ PaymentModeID: bigint }>(`
        SELECT TOP 1 PaymentModeID FROM dbo.PaymentModes WHERE UPPER(PaymentModeCode) = 'ONLINE'
      `);
      const paymentModeId = modeRes.recordset[0]?.PaymentModeID || 2;

      await pool
        .request()
        .input('orderId', sql.BigInt, orderId)
        .input('paymentModeId', sql.BigInt, paymentModeId)
        .input('amount', sql.Decimal(18, 2), order.TotalAmount)
        .input('gateway', sql.VarChar(50), gateway.providerName)
        .input('merchantTxnId', sql.NVarChar(100), initResult.merchantTransactionId)
        .input('rawJson', sql.NVarChar(sql.MAX), rawResponseStr)
        .query(`
          INSERT INTO dbo.Payments (
            OrderID, PaymentModeID, Amount, Status,
            PaymentGateway, MerchantTransactionID, RawResponseJson,
            CreatedAt, UpdatedAt
          )
          VALUES (
            @orderId, @paymentModeId, @amount, 'PENDING',
            @gateway, @merchantTxnId, @rawJson,
            SYSUTCDATETIME(), SYSUTCDATETIME()
          )
        `);
    }

    logger.info(
      `Payment initiated for Order #${order.OrderNumber} via [${gateway.providerName}] - Txn: ${initResult.merchantTransactionId}`,
      undefined,
      'PaymentsService'
    );

    return {
      orderId: String(order.OrderID),
      orderNumber: order.OrderNumber,
      merchantTransactionId: initResult.merchantTransactionId,
      checkoutUrl: initResult.checkoutUrl,
      gateway: gateway.providerName,
    };
  }

  /**
   * Helper to retrieve CustomerID associated with an order
   */
  async getCustomerIdForOrder(orderId: string | bigint): Promise<string | null> {
    try {
      const pool = await getPool();
      const res = await pool
        .request()
        .input('orderId', sql.BigInt, BigInt(orderId))
        .query<{ CustomerID: bigint }>(`
          SELECT TOP 1 CustomerID FROM dbo.Orders WHERE OrderID = @orderId
        `);
      return res.recordset.length > 0 ? String(res.recordset[0].CustomerID) : null;
    } catch {
      return null;
    }
  }

  /**
   * Way 2 (Synchronous Verification): Called by Frontend redirect return URL
   */
  async verifyPayment(input: VerifyPaymentInput) {
    const pool = await getPool();
    const orderId = BigInt(input.orderId);
    const customerId = input.customerId ? BigInt(input.customerId) : null;
    const merchantTxnId = input.merchantTransactionId?.trim() || null;

    const request = pool.request().input('orderId', sql.BigInt, orderId);

    let whereClause = 'o.OrderID = @orderId';
    if (customerId) {
      request.input('customerId', sql.BigInt, customerId);
      whereClause += ' AND o.CustomerID = @customerId';
    } else if (merchantTxnId) {
      request.input('merchantTxnId', sql.NVarChar(100), merchantTxnId);
      whereClause += ' AND p.MerchantTransactionID = @merchantTxnId';
    } else {
      throw new BadRequestError('Either customer identity or transaction ID is required to verify order payment.');
    }

    // 1. Fetch order & payment record
    const record = await request.query<{
      OrderID: bigint;
      OrderNumber: string;
      OrderStatus: string;
      PaymentID: bigint;
      PaymentStatus: string;
      PaymentGateway: string | null;
      MerchantTransactionID: string | null;
      TotalAmount: number;
    }>(`
      SELECT TOP 1 
        o.OrderID, o.OrderNumber, o.Status AS OrderStatus,
        p.PaymentID, p.Status AS PaymentStatus, p.PaymentGateway,
        p.MerchantTransactionID, o.TotalAmount
      FROM dbo.Orders o
      LEFT JOIN dbo.Payments p ON o.OrderID = p.OrderID
      WHERE ${whereClause}
      ORDER BY p.PaymentID DESC
    `);

    if (record.recordset.length === 0) {
      throw new NotFoundError('Order not found or access denied.');
    }

    const row = record.recordset[0];

    // If order or payment is ALREADY confirmed/successful, return immediately
    if (row.PaymentStatus?.toUpperCase() === 'SUCCESS' || row.OrderStatus?.toUpperCase() === 'CONFIRMED') {
      return {
        status: 'SUCCESS',
        orderId: String(row.OrderID),
        orderNumber: row.OrderNumber,
        message: 'Payment has been successfully verified.',
      };
    }


    if (!merchantTxnId) {
      return {
        status: row.PaymentStatus || 'PENDING',
        orderId: String(row.OrderID),
        orderNumber: row.OrderNumber,
        message: 'No active transaction found to verify.',
      };
    }

    // 2. Query Gateway status directly
    const gateway = PaymentGatewayFactory.getGateway(row.PaymentGateway || undefined);
    const inquiry = await gateway.verifyPayment(merchantTxnId);

    const rawResponseStr = inquiry.rawResponse ? JSON.stringify(inquiry.rawResponse) : null;

    if (inquiry.status === 'SUCCESS') {
      // Transition order to CONFIRMED and payment to SUCCESS
      await pool
        .request()
        .input('orderId', sql.BigInt, orderId)
        .input('gatewayRef', sql.NVarChar(255), inquiry.gatewayTransactionId || null)
        .input('rawJson', sql.NVarChar(sql.MAX), rawResponseStr)
        .query(`
          UPDATE dbo.Payments
          SET Status = 'SUCCESS',
              PaidAt = SYSUTCDATETIME(),
              GatewayReference = ISNULL(@gatewayRef, GatewayReference),
              RawResponseJson = @rawJson,
              UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId;

          UPDATE dbo.Orders
          SET Status = 'CONFIRMED',
              UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND Status != 'CONFIRMED';

          -- Permanently lock reservation by clearing expiration TTL
          UPDATE dbo.InventoryReservations
          SET ExpiresAt = NULL,
              UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND Status = 'RESERVED';
        `);

      logger.info(`Order #${row.OrderNumber} payment confirmed via synchronous inquiry`, undefined, 'PaymentsService');

      return {
        status: 'SUCCESS',
        orderId: String(row.OrderID),
        orderNumber: row.OrderNumber,
        message: 'Payment verified successfully.',
      };
    } else if (inquiry.status === 'FAILED') {
      await pool
        .request()
        .input('orderId', sql.BigInt, orderId)
        .input('reason', sql.NVarChar(500), inquiry.failureReason || 'Payment declined or cancelled by user')
        .input('rawJson', sql.NVarChar(sql.MAX), rawResponseStr)
        .query(`
          UPDATE dbo.Payments
          SET Status = 'FAILED',
              FailureReason = @reason,
              RawResponseJson = @rawJson,
              UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId;

          UPDATE dbo.Orders
          SET Status = 'PAYMENT_FAILED',
              UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND Status = 'PENDING_PAYMENT';
        `);

      logger.warn(`Order #${row.OrderNumber} payment failed: ${inquiry.failureReason}`, undefined, 'PaymentsService');

      return {
        status: 'FAILED',
        orderId: String(row.OrderID),
        orderNumber: row.OrderNumber,
        failureReason: inquiry.failureReason || 'Payment failed',
      };
    }

    return {
      status: 'PENDING',
      orderId: String(row.OrderID),
      orderNumber: row.OrderNumber,
      message: 'Payment is currently pending bank confirmation.',
    };
  }

  /**
   * Way 1 (Asynchronous Webhook): Called by PhonePe Server-to-Server
   */
  async handleWebhook(headers: Record<string, any>, rawBody: any) {
    const gateway = PaymentGatewayFactory.getGateway('PHONEPE');
    const verification = await gateway.verifyWebhook(headers, rawBody);

    if (!verification.isValid || !verification.event) {
      logger.warn('PhonePe webhook signature or payload invalid:', verification.errorMessage, 'PaymentsService');
      return { success: false, message: verification.errorMessage || 'Invalid webhook event' };
    }

    const { merchantTransactionId, gatewayTransactionId, status, failureReason, rawResponse } = verification.event;

    const pool = await getPool();

    // Find the payment row
    const payRes = await pool
      .request()
      .input('merchantTxnId', sql.NVarChar(100), merchantTransactionId)
      .query<{
        PaymentID: bigint;
        OrderID: bigint;
        CurrentStatus: string;
      }>(`
        SELECT TOP 1 PaymentID, OrderID, Status AS CurrentStatus
        FROM dbo.Payments
        WHERE MerchantTransactionID = @merchantTxnId
      `);

    if (payRes.recordset.length === 0) {
      logger.warn(`Webhook received for unknown MerchantTransactionID: ${merchantTransactionId}`, undefined, 'PaymentsService');
      return { success: true, message: 'Transaction not found in Saamaan, acknowledged' };
    }

    const payment = payRes.recordset[0];

    // Idempotency guard: If already successful, acknowledge and exit
    if (payment.CurrentStatus?.toUpperCase() === 'SUCCESS') {
      logger.info(`Webhook for ${merchantTransactionId} already processed (idempotent ignore)`, undefined, 'PaymentsService');
      return { success: true, message: 'Already processed' };
    }

    const rawResponseStr = rawResponse ? JSON.stringify(rawResponse) : null;

    if (status === 'SUCCESS') {
      await pool
        .request()
        .input('paymentId', sql.BigInt, payment.PaymentID)
        .input('orderId', sql.BigInt, payment.OrderID)
        .input('gatewayRef', sql.NVarChar(255), gatewayTransactionId || null)
        .input('rawJson', sql.NVarChar(sql.MAX), rawResponseStr)
        .query(`
          UPDATE dbo.Payments
          SET Status = 'SUCCESS',
              PaidAt = SYSUTCDATETIME(),
              GatewayReference = ISNULL(@gatewayRef, GatewayReference),
              RawResponseJson = @rawJson,
              UpdatedAt = SYSUTCDATETIME()
          WHERE PaymentID = @paymentId;

          UPDATE dbo.Orders
          SET Status = 'CONFIRMED',
              UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND Status != 'CONFIRMED';

          -- Permanently lock reservation by clearing expiration TTL
          UPDATE dbo.InventoryReservations
          SET ExpiresAt = NULL,
              UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND Status = 'RESERVED';
        `);

      logger.info(`Order #${payment.OrderID} successfully confirmed via PhonePe Webhook!`, undefined, 'PaymentsService');
    } else if (status === 'FAILED') {
      await pool
        .request()
        .input('paymentId', sql.BigInt, payment.PaymentID)
        .input('orderId', sql.BigInt, payment.OrderID)
        .input('reason', sql.NVarChar(500), failureReason || 'Payment failed')
        .input('rawJson', sql.NVarChar(sql.MAX), rawResponseStr)
        .query(`
          UPDATE dbo.Payments
          SET Status = 'FAILED',
              FailureReason = @reason,
              RawResponseJson = @rawJson,
              UpdatedAt = SYSUTCDATETIME()
          WHERE PaymentID = @paymentId;

          UPDATE dbo.Orders
          SET Status = 'PAYMENT_FAILED',
              UpdatedAt = SYSUTCDATETIME()
          WHERE OrderID = @orderId AND Status = 'PENDING_PAYMENT';
        `);

      logger.warn(`Order #${payment.OrderID} payment failed via webhook: ${failureReason}`, undefined, 'PaymentsService');
    }

    return { success: true };
  }
}

export const paymentsService = new PaymentsService();

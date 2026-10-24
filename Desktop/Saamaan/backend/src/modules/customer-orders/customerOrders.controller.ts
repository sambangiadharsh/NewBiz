import { Request, Response, NextFunction } from 'express';
import { customerOrdersService } from './customerOrders.service.js';
import { sendSuccess } from '../../utils/response.js';
import { UnauthorizedError, BadRequestError } from '../../utils/errors.js';
import { getPool, sql } from '../../database/db.js';

export class CustomerOrdersController {
  private getCustomerId(req: Request): bigint | null {
    const customerId = req.user?.userId;
    return customerId ? BigInt(customerId) : null;
  }

  /**
   * Resolves or provisions a customer ID for checkout.
   * If logged in -> use authenticated CustomerID.
   * If guest -> find or provision an active customer record using the address recipient details.
   */
  private async resolveCustomerIdForOrder(req: Request, rawAddress?: any): Promise<bigint> {
    const authId = this.getCustomerId(req);
    if (authId) return authId;

    const pool = await getPool();

    // Try finding customer by phone number from address
    if (rawAddress?.phoneNumber) {
      const byPhone = await pool
        .request()
        .input('phone', sql.NVarChar, rawAddress.phoneNumber)
        .query<{ CustomerID: bigint }>(`
          SELECT TOP 1 CustomerID FROM dbo.Customers WHERE PhoneNumber = @phone
        `);
      if (byPhone.recordset.length > 0) {
        return byPhone.recordset[0].CustomerID;
      }
    }

    // Try finding customer by email if provided
    if (req.body?.email || rawAddress?.email) {
      const email = req.body?.email || rawAddress?.email;
      const byEmail = await pool
        .request()
        .input('email', sql.NVarChar, email)
        .query<{ CustomerID: bigint }>(`
          SELECT TOP 1 CustomerID FROM dbo.Customers WHERE Email = @email
        `);
      if (byEmail.recordset.length > 0) {
        return byEmail.recordset[0].CustomerID;
      }
    }

    // Provision a guest customer record
    const fullName = (rawAddress?.recipientName || 'Guest Shopper').trim();
    const parts = fullName.split(' ');
    const firstName = parts[0] || 'Guest';
    const lastName = parts.slice(1).join(' ') || 'Customer';
    const phone = rawAddress?.phoneNumber || null;
    const email = req.body?.email || rawAddress?.email || `guest_${Date.now()}@saaman.shop`;

    const createRes = await pool
      .request()
      .input('fn', sql.NVarChar, firstName)
      .input('ln', sql.NVarChar, lastName)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone)
      .query<{ CustomerID: bigint }>(`
        INSERT INTO dbo.Customers (
          FirstName, LastName, Email, PhoneNumber, Status, CreatedAt
        )
        OUTPUT INSERTED.CustomerID
        VALUES (
          @fn, @ln, @email, @phone, 'ACTIVE', SYSUTCDATETIME()
        )
      `);

    return createRes.recordset[0].CustomerID;
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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

      const customerId = await this.resolveCustomerIdForOrder(req, rawAddress);

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

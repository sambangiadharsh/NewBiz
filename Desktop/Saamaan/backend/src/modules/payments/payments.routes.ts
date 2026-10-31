import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { paymentsController } from './payments.controller.js';
import { config } from '../../config/index.js';
import { authRepository } from '../auth/auth.repository.js';
import { JwtPayload } from '../../types/auth.js';

export const paymentsRouter = Router();

/**
 * Optional authentication helper: handles both logged-in customer and guest orders
 */
const authenticateOptional = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
      if (decoded.roles && decoded.roles.includes('CUSTOMER')) {
        const customer = await authRepository.findCustomerById(BigInt(decoded.userId));
        if (customer && customer.Status === 'ACTIVE') {
          req.user = {
            userId: String(customer.CustomerID),
            email: customer.Email || '',
            firstName: customer.FirstName,
            lastName: customer.LastName,
            status: customer.Status,
            roles: ['CUSTOMER'],
            permissions: [],
            sellers: [],
            warehouses: [],
          };
        }
      }
    }
  } catch {
    // Proceed if unauthenticated (e.g. guest order tracking)
  }
  next();
};

// 1. POST /api/v1/payments/initiate - Start payment session for an order
paymentsRouter.post('/initiate', authenticateOptional, (req, res, next) => {
  paymentsController.initiate(req, res).catch(next);
});

// 2. GET /api/v1/payments/verify/:orderId - Synchronous return check from PhonePe (Way 2)
paymentsRouter.get('/verify/:orderId', authenticateOptional, (req, res, next) => {
  paymentsController.verify(req, res).catch(next);
});

// 3. POST /api/v1/payments/webhook/phonepe - Asynchronous server-to-server webhook (Way 1)
paymentsRouter.post('/webhook/phonepe', (req, res, next) => {
  paymentsController.phonepeWebhook(req, res).catch(next);
});

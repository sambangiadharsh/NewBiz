import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { customerOrdersController } from './customerOrders.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { config } from '../../config/index.js';
import { authRepository } from '../auth/auth.repository.js';
import { JwtPayload } from '../../types/auth.js';

export const customerOrdersRouter = Router();

/**
 * Optional authentication middleware for checkout.
 * If a valid Customer Bearer token is provided, attaches req.user.
 * If not provided, allows the request through as a guest.
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
    // Guest checkout proceeds without error
  }
  next();
};

// POST /api/v1/customer/orders (Place order)
customerOrdersRouter.post('/', authenticateOptional, (req, res, next) => {
  customerOrdersController.create(req, res, next);
});

// GET /api/v1/customer/orders (List customer's past orders)
customerOrdersRouter.get('/', authenticate, requireRoles('CUSTOMER'), (req, res, next) => {
  customerOrdersController.list(req, res, next);
});

// GET /api/v1/customer/orders/:orderId/invoice/pdf (Download Tax Invoice PDF)
customerOrdersRouter.get('/:orderId/invoice/pdf', authenticate, requireRoles('CUSTOMER'), (req, res, next) => {
  customerOrdersController.downloadInvoicePdf(req, res, next);
});

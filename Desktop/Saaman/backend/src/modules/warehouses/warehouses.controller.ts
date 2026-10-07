import { Request, Response, NextFunction } from 'express';
import { warehousesService } from './warehouses.service.js';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  assignWarehouseUserSchema,
  acceptInviteExistingSchema,
  registerAndAcceptInviteSchema,
} from './warehouses.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { BadRequestError } from '../../utils/errors.js';
import { config } from '../../config/index.js';
import { getPortalCookieName } from '../../utils/portalCookie.js';

export class WarehousesController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await warehousesService.listWarehouses({
        type,
        status,
        search,
        page,
        limit,
      });

      return sendSuccess(res, result, 'Warehouses fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = BigInt(req.params.id);
      const warehouse = await warehousesService.getWarehouseById(warehouseId);
      return sendSuccess(res, warehouse, 'Warehouse details retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getMyWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const warehouse = await warehousesService.getMyWarehouse(userId);
      return sendSuccess(res, warehouse, 'Assigned warehouse retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getMyWarehouseStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const warehouseIdParam = req.query.warehouseId ? BigInt(req.query.warehouseId as string) : undefined;
      const stats = await warehousesService.getMyWarehouseStats(userId, warehouseIdParam);
      return sendSuccess(res, stats, 'Warehouse live statistics retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getWarehouseStats(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = BigInt(req.params.id);
      const stats = await warehousesService.getWarehouseStats(warehouseId);
      return sendSuccess(res, stats, 'Warehouse facility statistics retrieved');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createWarehouseSchema.parse(req.body);
      const adminUserId = BigInt(req.user!.userId);
      const created = await warehousesService.createWarehouse(adminUserId, input);
      return sendSuccess(res, created, 'Warehouse created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = BigInt(req.params.id);
      const input = updateWarehouseSchema.parse(req.body);
      const adminUserId = BigInt(req.user!.userId);
      const updated = await warehousesService.updateWarehouse(adminUserId, warehouseId, input);
      return sendSuccess(res, updated, 'Warehouse updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignUser(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = BigInt(req.params.id);
      const input = assignWarehouseUserSchema.parse(req.body);
      const adminUserId = BigInt(req.user!.userId);
      const updated = await warehousesService.assignUser(adminUserId, warehouseId, input);
      return sendSuccess(res, updated, 'Warehouse staff member assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeUser(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = BigInt(req.params.id);
      const targetUserId = BigInt(req.params.userId);
      const adminUserId = BigInt(req.user!.userId);
      const updated = await warehousesService.removeUser(adminUserId, warehouseId, targetUserId);
      return sendSuccess(res, updated, 'Staff member removed from warehouse');
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = BigInt(req.params.id);
      const adminUserId = BigInt(req.user!.userId);
      const approved = await warehousesService.approveWarehouse(adminUserId, warehouseId);
      return sendSuccess(res, approved, 'Warehouse approved and activated successfully');
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = BigInt(req.params.id);
      const adminUserId = BigInt(req.user!.userId);
      const { rejectionReason } = req.body || {};
      const rejected = await warehousesService.rejectWarehouse(adminUserId, warehouseId, rejectionReason);
      return sendSuccess(res, rejected, 'Warehouse application rejected');
    } catch (error) {
      next(error);
    }
  }

  async requestRework(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = BigInt(req.params.id);
      const adminUserId = BigInt(req.user!.userId);
      const { comments } = req.body || {};
      const updated = await warehousesService.requestWarehouseRework(adminUserId, warehouseId, comments);
      return sendSuccess(res, updated, 'Rework requested for warehouse application');
    } catch (error) {
      next(error);
    }
  }

  async getStatusHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = BigInt(req.params.id);
      const history = await warehousesService.getWarehouseStatusHistory(warehouseId);
      return sendSuccess(res, history, 'Warehouse status history retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async linkSeller(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = BigInt(req.user!.userId);
      const { sellerId, warehouseId, isPrimary } = req.body;
      if (!sellerId || !warehouseId) {
        throw new BadRequestError('sellerId and warehouseId are required');
      }
      const updated = await warehousesService.linkSellerTo3PLWarehouse(
        adminUserId,
        BigInt(sellerId),
        BigInt(warehouseId),
        isPrimary
      );
      return sendSuccess(res, updated, 'Merchant linked to 3PL warehouse successfully');
    } catch (error) {
      next(error);
    }
  }

  async reviewLinkage(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = BigInt(req.user!.userId);
      const sellerWarehouseId = BigInt(req.params.id);
      const { decision, comments } = req.body;
      if (!['APPROVE', 'REJECT'].includes(decision)) {
        throw new BadRequestError("decision must be either 'APPROVE' or 'REJECT'");
      }
      const updated = await warehousesService.reviewSellerLinkage(
        adminUserId,
        sellerWarehouseId,
        decision,
        comments
      );
      return sendSuccess(res, updated, `Seller linkage request ${decision === 'APPROVE' ? 'approved' : 'rejected'}`);
    } catch (error) {
      next(error);
    }
  }

  async unlinkSeller(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = BigInt(req.user!.userId);
      const sellerWarehouseId = BigInt(req.params.id);
      const updated = await warehousesService.unlinkSellerFromWarehouse(adminUserId, sellerWarehouseId);
      return sendSuccess(res, updated, 'Seller unlinked from warehouse');
    } catch (error) {
      next(error);
    }
  }

  async getDocumentRequirements(req: Request, res: Response, next: NextFunction) {
    try {
      const type = (req.query.type as string) || 'OWN';
      const requirements = await warehousesService.getWarehouseDocumentRequirements(type);
      return sendSuccess(res, requirements, 'Warehouse document requirements retrieved');
    } catch (error) {
      next(error);
    }
  }

  async reviewDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = BigInt(req.user!.userId);
      const docId = BigInt(req.params.id);
      const { decision, rejectionReason } = req.body;
      if (!['VERIFY', 'REJECT'].includes(decision)) {
        throw new BadRequestError("decision must be either 'VERIFY' or 'REJECT'");
      }
      const reviewed = await warehousesService.reviewWarehouseDocument(
        adminUserId,
        docId,
        decision,
        rejectionReason
      );
      return sendSuccess(res, reviewed, `Warehouse document ${decision === 'VERIFY' ? 'verified' : 'rejected'}`);
    } catch (error) {
      next(error);
    }
  }

  async validateInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.params.token;
      const result = await warehousesService.validateInvitationToken(token);
      return sendSuccess(res, result, 'Invitation token is valid');
    } catch (error) {
      next(error);
    }
  }

  async acceptInviteExisting(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.params.token;
      const input = acceptInviteExistingSchema.parse(req.body || {});
      const currentUserId = req.user ? BigInt(req.user.userId) : undefined;
      const result = await warehousesService.acceptInvitationExistingUser(token, currentUserId, input.password);

      // Set cookie for warehouse portal
      const cookieName = getPortalCookieName(req);
      res.cookie(cookieName, result.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'lax' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async registerAndAcceptInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.params.token;
      const input = registerAndAcceptInviteSchema.parse(req.body);
      const result = await warehousesService.registerAndAcceptInvitation(token, input);

      // Set cookie for warehouse portal
      const cookieName = getPortalCookieName(req);
      res.cookie(cookieName, result.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: config.NODE_ENV === 'production' ? 'lax' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      return sendSuccess(res, result, result.message, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const warehousesController = new WarehousesController();

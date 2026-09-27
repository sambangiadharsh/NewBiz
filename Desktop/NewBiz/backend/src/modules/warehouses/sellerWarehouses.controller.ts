import { Request, Response, NextFunction } from 'express';
import { warehousesService } from './warehouses.service.js';
import {
  createSellerWarehouseSchema,
  uploadWarehouseDocumentSchema,
  assignWarehouseUserSchema,
} from './warehouses.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { BadRequestError } from '../../utils/errors.js';

export class SellerWarehousesController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const warehouses = await warehousesService.listSellerWarehouses(userId);
      return sendSuccess(res, warehouses, 'Seller warehouses retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const warehouseId = BigInt(req.params.id);
      const warehouse = await warehousesService.getSellerWarehouseById(userId, warehouseId);
      return sendSuccess(res, warehouse, 'Seller warehouse details retrieved');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const input = createSellerWarehouseSchema.parse(req.body);
      const created = await warehousesService.createSellerWarehouse(userId, input);
      return sendSuccess(res, created, 'Warehouse submitted for approval successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async listAvailable3PL(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const list = await warehousesService.listAvailable3PLWarehouses(userId);
      return sendSuccess(res, list, 'Available 3PL partner facilities retrieved');
    } catch (error) {
      next(error);
    }
  }

  async connect3PL(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const { warehouseId, isPrimary, notes } = req.body;
      if (!warehouseId) {
        throw new BadRequestError('Target 3PL warehouseId is required');
      }
      const connected = await warehousesService.request3PLConnection(
        userId,
        BigInt(warehouseId),
        isPrimary,
        notes
      );
      return sendSuccess(res, connected, '3PL warehouse connection requested successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const warehouseId = BigInt(req.params.id);
      const result = await warehousesService.disconnect3PLWarehouse(userId, warehouseId);
      return sendSuccess(res, result, 'Disconnected from 3PL facility');
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

  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      if (!req.file) {
        throw new BadRequestError('Document file is required');
      }
      const userId = BigInt(req.user.userId);
      const sellerWarehouseId = BigInt(req.params.id);
      const input = uploadWarehouseDocumentSchema.parse(req.body);

      const doc = await warehousesService.uploadSellerWarehouseDocument(
        userId,
        sellerWarehouseId,
        input,
        req.file
      );
      return sendSuccess(res, doc, 'Warehouse document uploaded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async listStaff(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const warehouseId = BigInt(req.params.id);
      const staff = await warehousesService.listSellerWarehouseStaff(userId, warehouseId);
      return sendSuccess(res, staff, 'Warehouse staff retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignStaff(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const warehouseId = BigInt(req.params.id);
      const input = assignWarehouseUserSchema.parse(req.body);
      const result = await warehousesService.assignSellerWarehouseStaff(userId, warehouseId, input);
      return sendSuccess(res, result, 'Staff member assigned to warehouse successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async removeStaff(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const warehouseId = BigInt(req.params.id);
      const targetUserId = BigInt(req.params.userId);
      const result = await warehousesService.removeSellerWarehouseStaff(userId, warehouseId, targetUserId);
      return sendSuccess(res, result, 'Staff member removed from warehouse successfully');
    } catch (error) {
      next(error);
    }
  }

  async resubmit(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const warehouseId = BigInt(req.params.id);
      const { remarks } = req.body || {};
      const resubmitted = await warehousesService.resubmitSellerWarehouse(userId, warehouseId, remarks);
      return sendSuccess(res, resubmitted, 'Warehouse application resubmitted successfully for review');
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
}

export const sellerWarehousesController = new SellerWarehousesController();


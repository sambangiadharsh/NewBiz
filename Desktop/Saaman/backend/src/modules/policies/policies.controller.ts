import { Request, Response, NextFunction } from 'express';
import { policiesService } from './policies.service.js';
import { sendSuccess } from '../../utils/response.js';

export const policiesController = {
  // Return Policies
  async listReturnPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search } = req.query;
      const data = await policiesService.listReturnPolicies({
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
      });
      sendSuccess(res, data, 'Return policies fetched successfully');
    } catch (err) {
      next(err);
    }
  },

  async getReturnPolicyById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await policiesService.getReturnPolicyById(id);
      sendSuccess(res, data, 'Return policy fetched successfully');
    } catch (err) {
      next(err);
    }
  },

  async createReturnPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId ? BigInt((req as any).user.userId) : undefined;
      const data = await policiesService.createReturnPolicy(req.body, userId);
      sendSuccess(res, data, 'Return policy created successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateReturnPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const userId = (req as any).user?.userId ? BigInt((req as any).user.userId) : undefined;
      const data = await policiesService.updateReturnPolicy(id, req.body, userId);
      sendSuccess(res, data, 'Return policy updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async toggleReturnPolicyStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const userId = (req as any).user?.userId ? BigInt((req as any).user.userId) : undefined;
      const data = await policiesService.toggleReturnPolicyStatus(id, userId);
      sendSuccess(res, data, 'Return policy status updated');
    } catch (err) {
      next(err);
    }
  },

  // Warranty Policies
  async listWarrantyPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search } = req.query;
      const data = await policiesService.listWarrantyPolicies({
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
      });
      sendSuccess(res, data, 'Warranty policies fetched successfully');
    } catch (err) {
      next(err);
    }
  },

  async getWarrantyPolicyById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await policiesService.getWarrantyPolicyById(id);
      sendSuccess(res, data, 'Warranty policy fetched successfully');
    } catch (err) {
      next(err);
    }
  },

  async createWarrantyPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId ? BigInt((req as any).user.userId) : undefined;
      const data = await policiesService.createWarrantyPolicy(req.body, userId);
      sendSuccess(res, data, 'Warranty policy created successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateWarrantyPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const userId = (req as any).user?.userId ? BigInt((req as any).user.userId) : undefined;
      const data = await policiesService.updateWarrantyPolicy(id, req.body, userId);
      sendSuccess(res, data, 'Warranty policy updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async toggleWarrantyPolicyStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const userId = (req as any).user?.userId ? BigInt((req as any).user.userId) : undefined;
      const data = await policiesService.toggleWarrantyPolicyStatus(id, userId);
      sendSuccess(res, data, 'Warranty policy status updated');
    } catch (err) {
      next(err);
    }
  },
};

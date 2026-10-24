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
};

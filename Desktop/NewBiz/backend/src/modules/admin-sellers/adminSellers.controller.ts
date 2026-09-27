import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminSellersService } from './adminSellers.service.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';

const verifyDocSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().max(500).optional(),
});

const decisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(1000).optional(),
});

export const listApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await adminSellersService.listApplications({ status, page, limit });
    return sendPaginated(
      res,
      result.items,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      'Seller applications fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const listActiveSellers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const result = await adminSellersService.listActiveSellers({ status, page, limit });
    return sendPaginated(
      res,
      result.items,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      'Active merchants fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const getApplicationDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = BigInt(req.params.id);
    const result = await adminSellersService.getApplicationDetails(applicationId);
    return sendSuccess(res, result, 'Application details fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const verifyDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docId = BigInt(req.params.docId);
    const adminUserId = BigInt(req.user!.userId);
    const { status, rejectionReason } = verifyDocSchema.parse(req.body);

    const result = await adminSellersService.verifyDocument(docId, adminUserId, status, rejectionReason);
    return sendSuccess(res, result, `Document ${status.toLowerCase()} successfully`);
  } catch (error) {
    next(error);
  }
};

export const makeDecision = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = BigInt(req.params.id);
    const adminUserId = BigInt(req.user!.userId);
    const { decision, rejectionReason } = decisionSchema.parse(req.body);

    const result = await adminSellersService.makeDecision(applicationId, adminUserId, decision, rejectionReason);
    return sendSuccess(
      res,
      result,
      `Application ${decision === 'APPROVE' ? 'approved and seller activated' : 'rejected'} successfully`
    );
  } catch (error) {
    next(error);
  }
};

export const reopenApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = BigInt(req.params.id);
    const adminUserId = BigInt(req.user!.userId);
    const correctionNote = req.body?.correctionNote as string | undefined;

    const result = await adminSellersService.reopenApplication(applicationId, adminUserId, correctionNote);
    return sendSuccess(res, result, 'Application sent back for correction successfully');
  } catch (error) {
    next(error);
  }
};

const onboardSellerSchema = z.object({
  sellerName: z.string().min(2, 'Brand / Store name is required').max(100),
  businessName: z.string().min(2, 'Legal business entity name is required').max(150),
  email: z.string().email('Valid merchant contact email is required'),
  phoneNumber: z.string().min(10, 'Valid 10-digit phone number is required').max(15),
  primaryCategoryId: z.number().int().positive('Valid primary operating category is required'),
  instagramUrl: z.string().url().optional().or(z.literal('')),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  initialStatus: z.enum(['APPROVED', 'PENDING']).default('APPROVED'),
  temporaryPassword: z.string().min(6).optional(),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
});

export const onboardSeller = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminUserId = BigInt(req.user!.userId);
    const input = onboardSellerSchema.parse(req.body);

    const result = await adminSellersService.onboardSeller(adminUserId, {
      ...input,
      instagramUrl: input.instagramUrl || undefined,
      facebookUrl: input.facebookUrl || undefined,
    });

    return sendSuccess(res, result, 'Merchant onboarded and provisioned successfully', 201);
  } catch (error) {
    next(error);
  }
};

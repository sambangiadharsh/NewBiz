import { Request, Response, NextFunction } from 'express';
import { sellerOnboardingService } from './sellerOnboarding.service.js';
import { masterProfileSchema, documentUploadSchema } from './sellerOnboarding.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { BadRequestError } from '../../utils/errors.js';

export const getStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = BigInt(req.user!.userId);
    const result = await sellerOnboardingService.getOnboardingStatus(userId);
    return sendSuccess(res, result, 'Seller onboarding status fetched');
  } catch (error) {
    next(error);
  }
};

export const saveProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = BigInt(req.user!.userId);
    const validatedData = masterProfileSchema.parse(req.body);
    const result = await sellerOnboardingService.saveMasterProfile(userId, validatedData);
    return sendSuccess(res, result, 'Business profile saved successfully');
  } catch (error) {
    next(error);
  }
};

export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = BigInt(req.user!.userId);

    if (!req.file) {
      throw new BadRequestError('Please attach a document file to upload');
    }

    const { documentTypeCode, certificateNumber } = documentUploadSchema.parse(req.body);

    const result = await sellerOnboardingService.uploadDocument(
      userId,
      documentTypeCode,
      certificateNumber,
      req.file
    );

    return sendSuccess(res, result, 'Document uploaded and attached successfully');
  } catch (error) {
    next(error);
  }
};

export const updateCertificateNumber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = BigInt(req.user!.userId);
    const { code } = req.params;
    const { certificateNumber } = req.body;

    if (typeof certificateNumber !== 'string') {
      throw new BadRequestError('certificateNumber must be a string');
    }

    const result = await sellerOnboardingService.updateCertificateNumber(
      userId,
      code,
      certificateNumber
    );

    return sendSuccess(res, result, 'Certificate number updated successfully');
  } catch (error) {
    next(error);
  }
};

export const submitApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = BigInt(req.user!.userId);
    const result = await sellerOnboardingService.submitApplication(userId);
    return sendSuccess(res, result, 'Master application submitted successfully for verification');
  } catch (error) {
    next(error);
  }
};

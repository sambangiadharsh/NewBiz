import { Router } from 'express';
import { warehouseReturnsController } from './warehouseReturns.controller.js';
import { authenticate, requireAnyPermission } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  uploadReturnProofs,
  processAndSaveReturnProofImage,
} from '../customer-orders/returnProof.upload.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const warehouseReturnsRouter = Router();

// Protect all warehouse return routes with authentication & warehouse permissions
warehouseReturnsRouter.use(
  authenticate,
  requireAnyPermission(PERMISSIONS.WAREHOUSES_READ, PERMISSIONS.FULFILLMENTS_MANAGE, PERMISSIONS.INVENTORY_MANAGE)
);

// Upload dock unboxing proof photos
warehouseReturnsRouter.post(
  '/upload-proof',
  uploadReturnProofs.array('photos', 5),
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return sendError(res, 'NO_FILES_UPLOADED', 'Please select at least one photo.', 400);
      }
      const fileUrls: string[] = [];
      for (const file of files) {
        const savedUrl = await processAndSaveReturnProofImage(file);
        fileUrls.push(savedUrl);
      }
      return sendSuccess(res, { urls: fileUrls }, 'Photos uploaded and optimized successfully');
    } catch (err: any) {
      return sendError(res, 'PROOF_UPLOAD_FAILED', err.message || 'Failed to upload photos', 500);
    }
  }
);

// List warehouse return queue
warehouseReturnsRouter.get('/', (req, res) => warehouseReturnsController.getReturnsList(req, res));

// Mark parcel received at dock
warehouseReturnsRouter.post('/:returnRequestId/receive', (req, res) =>
  warehouseReturnsController.markReceived(req, res)
);

// Submit physical QC inspection
warehouseReturnsRouter.post('/:returnRequestId/qc', (req, res) =>
  warehouseReturnsController.submitQC(req, res)
);

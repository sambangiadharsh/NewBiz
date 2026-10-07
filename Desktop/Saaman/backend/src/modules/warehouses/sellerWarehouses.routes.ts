import { Router } from 'express';
import { sellerWarehousesController } from './sellerWarehouses.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { warehouseDocumentUpload } from '../../services/storage/StorageService.js';

export const sellerWarehousesRouter = Router();

// All routes require authentication and SELLER_ADMIN or SUPER_ADMIN role
sellerWarehousesRouter.use(authenticate, requireRoles('SELLER_ADMIN', 'SUPER_ADMIN'));

// 1. List warehouses associated with authenticated seller
sellerWarehousesRouter.get('/', sellerWarehousesController.list);

// 2. Discover available 3PL partner facilities for seller connection
sellerWarehousesRouter.get('/available-3pl', sellerWarehousesController.listAvailable3PL);

// 3. Dynamic document requirements for warehouse onboarding
sellerWarehousesRouter.get('/document-requirements', sellerWarehousesController.getDocumentRequirements);

// 4. Request connection to an active 3PL warehouse
sellerWarehousesRouter.post('/connect-3pl', sellerWarehousesController.connect3PL);

// 5. Get details for a specific warehouse belonging to authenticated seller
sellerWarehousesRouter.get('/:id', sellerWarehousesController.getById);

// 6. Submit a new seller-owned (OWN) warehouse application for admin approval
sellerWarehousesRouter.post('/', sellerWarehousesController.create);

// 7. Upload warehouse compliance document (e.g. APOB/VPOB, lease deed, 3PL agreement)
sellerWarehousesRouter.post(
  '/:id/documents',
  warehouseDocumentUpload.single('file'),
  sellerWarehousesController.uploadDocument
);

// 8. Disconnect from a 3PL warehouse
sellerWarehousesRouter.post('/:id/disconnect', sellerWarehousesController.disconnect);

// 9. List staff for seller-owned (OWN) warehouse
sellerWarehousesRouter.get('/:id/staff', sellerWarehousesController.listStaff);

// 10. Assign staff to seller-owned (OWN) warehouse
sellerWarehousesRouter.post('/:id/staff', sellerWarehousesController.assignStaff);

// 11. Remove staff from seller-owned (OWN) warehouse
sellerWarehousesRouter.delete('/:id/staff/:userId', sellerWarehousesController.removeStaff);

// 12. Personnel Invitations (Token-based onboarding)
sellerWarehousesRouter.get('/:id/invites', sellerWarehousesController.listInvites);
sellerWarehousesRouter.post('/:id/invites', sellerWarehousesController.sendInvite);
sellerWarehousesRouter.post('/:id/invites/:invitationId/resend', sellerWarehousesController.resendInvite);
sellerWarehousesRouter.delete('/:id/invites/:invitationId', sellerWarehousesController.revokeInvite);

// 12. Resubmit warehouse after addressing rework requests
sellerWarehousesRouter.post('/:id/resubmit', sellerWarehousesController.resubmit);

// 13. Warehouse status history timeline
sellerWarehousesRouter.get('/:id/history', sellerWarehousesController.getStatusHistory);

// 14. Set warehouse as primary fulfillment dispatch hub
sellerWarehousesRouter.post('/:id/primary', sellerWarehousesController.setPrimary);
sellerWarehousesRouter.post('/:id/set-primary', sellerWarehousesController.setPrimary);



import { Router } from 'express';
import { authenticate, requireAccess } from '../../middleware/auth.js';
import { bannersController } from './banners.controller.js';
import { bannerImageUpload } from '../../services/storage/StorageService.js';

export const adminBannersRouter = Router();
export const publicBannersRouter = Router();

// Public storefront route for active banners
publicBannersRouter.get('/', (req, res, next) =>
  bannersController.listPublicBanners(req, res, next)
);

// Admin routes require Super Admin, Admin, or catalog permissions
adminBannersRouter.use(
  authenticate,
  requireAccess({
    roles: ['SUPER_ADMIN', 'ADMIN'],
    permissions: ['catalog.manage', 'catalog.read'],
  })
);

// Banner image upload (accepts 'image' or 'file' field name)
adminBannersRouter.post(
  '/upload-image',
  (req, res, next) => {
    bannerImageUpload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'file', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) return next(err);
      if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        req.file = files['image']?.[0] || files['file']?.[0];
      }
      next();
    });
  },
  (req, res, next) => bannersController.uploadBannerImage(req, res, next)
);

// List all banners
adminBannersRouter.get('/', (req, res, next) =>
  bannersController.listBanners(req, res, next)
);

// Get single banner
adminBannersRouter.get('/:id', (req, res, next) =>
  bannersController.getBannerById(req, res, next)
);

// Create banner
adminBannersRouter.post('/', (req, res, next) =>
  bannersController.createBanner(req, res, next)
);

// Update banner
adminBannersRouter.put('/:id', (req, res, next) =>
  bannersController.updateBanner(req, res, next)
);

// Toggle banner status
adminBannersRouter.patch('/:id/status', (req, res, next) =>
  bannersController.toggleStatus(req, res, next)
);

// Delete banner
adminBannersRouter.delete('/:id', (req, res, next) =>
  bannersController.deleteBanner(req, res, next)
);

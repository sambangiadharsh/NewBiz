import { Router } from 'express';
import { authenticate, requireAccess } from '../../middleware/auth.js';
import { brandsController } from './brands.controller.js';
import { brandImageUpload } from '../../services/storage/StorageService.js';

export const adminBrandsRouter = Router();

// Require Super Admin, Admin, or catalog permissions
adminBrandsRouter.use(
  authenticate,
  requireAccess({
    roles: ['SUPER_ADMIN', 'ADMIN'],
    permissions: ['catalog.read', 'catalog.manage'],
  })
);

// Brand image upload (supports both 'image' and 'file' field names) 
adminBrandsRouter.post(
  '/upload-image',
  (req, res, next) => {
    brandImageUpload.fields([
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
  (req, res, next) => brandsController.uploadBrandImage(req, res, next)
);

// List all brands
adminBrandsRouter.get('/', (req, res, next) =>
  brandsController.listBrands(req, res, next)
);

// Get single brand
adminBrandsRouter.get('/:id', (req, res, next) =>
  brandsController.getBrandById(req, res, next)
);

// Get linked products for a brand
adminBrandsRouter.get('/:id/products', (req, res, next) =>
  brandsController.getBrandProducts(req, res, next)
);

// Create brand
adminBrandsRouter.post('/', (req, res, next) =>
  brandsController.createBrand(req, res, next)
);

// Update brand
adminBrandsRouter.put('/:id', (req, res, next) =>
  brandsController.updateBrand(req, res, next)
);

// Toggle featured status
adminBrandsRouter.patch('/:id/featured', (req, res, next) =>
  brandsController.toggleFeatured(req, res, next)
);

// Delete brand
adminBrandsRouter.delete('/:id', (req, res, next) =>
  brandsController.deleteBrand(req, res, next)
);

export const publicBrandsRouter = Router();

// Public storefront: List active brands (or featured brands)
publicBrandsRouter.get('/', (req, res, next) => {
  if (!req.query.status) {
    req.query.status = 'ACTIVE';
  }
  return brandsController.listBrands(req, res, next);
});


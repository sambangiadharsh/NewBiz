import { Router } from 'express';
import { productsController } from './products.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';

import { productAssetUpload } from '../../services/storage/StorageService.js';

// 1. Shared Catalog metadata router (Brands, UOMs, Category Attributes)
export const catalogSharedRouter = Router();
catalogSharedRouter.use(authenticate);
catalogSharedRouter.get('/categories/:categoryId/attributes', (req, res, next) =>
  productsController.getCategoryAttributes(req, res, next)
);
catalogSharedRouter.get('/brands', (req, res, next) =>
  productsController.getBrands(req, res, next)
);
catalogSharedRouter.get('/uoms', (req, res, next) =>
  productsController.getUOMs(req, res, next)
);

// 2. Seller Catalog router (Search, Listing, Proposal)
export const sellerCatalogRouter = Router();
sellerCatalogRouter.use(authenticate, requireRoles('SELLER_USER'));
sellerCatalogRouter.get('/search', (req, res, next) =>
  productsController.searchCatalog(req, res, next)
);
sellerCatalogRouter.get('/products', (req, res, next) =>
  productsController.getSellerProducts(req, res, next)
);
sellerCatalogRouter.post('/products', (req, res, next) =>
  productsController.createSellerProduct(req, res, next)
);
sellerCatalogRouter.get('/proposals', (req, res, next) =>
  productsController.getSellerProposals(req, res, next)
);
sellerCatalogRouter.post('/propose', (req, res, next) =>
  productsController.proposeProduct(req, res, next)
);
sellerCatalogRouter.post('/upload-asset', productAssetUpload.single('file'), (req, res, next) =>
  productsController.uploadAsset(req, res, next)
);
sellerCatalogRouter.post('/categories/:categoryId/apply', (req, res, next) =>
  productsController.applyForCategory(req, res, next)
);

// 3. Admin Catalog QC router
export const adminCatalogQCRouter = Router();
adminCatalogQCRouter.use(authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'));
adminCatalogQCRouter.get('/qc', (req, res, next) =>
  productsController.getAdminQCQueue(req, res, next)
);
adminCatalogQCRouter.post('/qc/:productId/review', (req, res, next) =>
  productsController.reviewProduct(req, res, next)
);

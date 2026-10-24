import { Router } from 'express';
import { productsController } from './products.controller.js';
import { authenticate, requireRoles, requireAccess } from '../../middleware/auth.js';

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
sellerCatalogRouter.use(authenticate, requireRoles('SELLER_ADMIN'));
sellerCatalogRouter.get('/search', (req, res, next) =>
  productsController.searchCatalog(req, res, next)
);
sellerCatalogRouter.get('/products', (req, res, next) =>
  productsController.getSellerProducts(req, res, next)
);
sellerCatalogRouter.post('/products', (req, res, next) =>
  productsController.createSellerProduct(req, res, next)
);
sellerCatalogRouter.post('/products/onboard', (req, res, next) =>
  productsController.onboardSellerProduct(req, res, next)
);
sellerCatalogRouter.post('/products/batch-onboard', (req, res, next) =>
  productsController.batchOnboardSellerProducts(req, res, next)
);
sellerCatalogRouter.post('/products/:id/warehouses', (req, res, next) =>
  productsController.assignSellerProductToWarehouses(req, res, next)
);
sellerCatalogRouter.get('/products/:id/transactions', (req, res, next) =>
  productsController.getProductTransactions(req, res, next)
);
sellerCatalogRouter.patch('/products/:id/pricing', (req, res, next) =>
  productsController.updateSellerProductPricing(req, res, next)
);
sellerCatalogRouter.get('/eligible-warehouses', (req, res, next) =>
  productsController.getEligibleWarehouses(req, res, next)
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

// 3. Admin Catalog QC & Product Management router
export const adminCatalogQCRouter = Router();
adminCatalogQCRouter.use(
  authenticate,
  requireAccess({
    roles: ['SUPER_ADMIN', 'ADMIN'],
    permissions: ['catalog.read', 'catalog.manage'],
  })
);
adminCatalogQCRouter.get('/qc', (req, res, next) =>
  productsController.getAdminQCQueue(req, res, next)
);
adminCatalogQCRouter.get('/list', (req, res, next) =>
  productsController.getAdminProductsList(req, res, next)
);
adminCatalogQCRouter.post('/qc/:productId/review', (req, res, next) =>
  productsController.reviewProduct(req, res, next)
);
adminCatalogQCRouter.post('/create', (req, res, next) =>
  productsController.adminCreateProduct(req, res, next)
);
adminCatalogQCRouter.post('/:productId/variants', (req, res, next) =>
  productsController.adminAddVariant(req, res, next)
);
adminCatalogQCRouter.post('/upload-asset', productAssetUpload.single('file'), (req, res, next) =>
  productsController.uploadAsset(req, res, next)
);
adminCatalogQCRouter.get('/:productId', (req, res, next) =>
  productsController.getAdminProductById(req, res, next)
);
adminCatalogQCRouter.put('/:productId', (req, res, next) =>
  productsController.adminUpdateProductMaster(req, res, next)
);
adminCatalogQCRouter.put('/:productId/variants/:variantId', (req, res, next) =>
  productsController.adminUpdateProductVariant(req, res, next)
);


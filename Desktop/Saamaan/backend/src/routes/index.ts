import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { categoryRouter, adminCategoryRouter } from '../modules/categories/category.routes.js';
import { sellerOnboardingRouter } from '../modules/seller-onboarding/sellerOnboarding.routes.js';
import { adminSellersRouter } from '../modules/admin-sellers/adminSellers.routes.js';
import { warehousesRouter } from '../modules/warehouses/warehouses.routes.js';
import { sellerWarehousesRouter } from '../modules/warehouses/sellerWarehouses.routes.js';
import { sellerDashboardRouter } from '../modules/seller-dashboard/sellerDashboard.routes.js';
import { adminDashboardRouter } from '../modules/admin-dashboard/adminDashboard.routes.js';
import { catalogMetadataRouter } from '../modules/admin-catalog/catalogMetadata.routes.js';
import {
  catalogSharedRouter,
  sellerCatalogRouter,
  adminCatalogQCRouter,
} from '../modules/products/products.routes.js';
import { contentPagesRouter } from '../modules/content-pages/contentPages.routes.js';
import { adminBrandsRouter, publicBrandsRouter } from '../modules/brands/brands.routes.js';
import { adminBannersRouter, publicBannersRouter } from '../modules/banners/banners.routes.js';
import { publicProductsRouter } from '../modules/products/publicProducts.routes.js';
import { adminPoliciesRouter, publicPoliciesRouter } from '../modules/policies/policies.routes.js';
import { sellerInventoryRouter } from '../modules/inventory/inventory.routes.js';
import { sellerOrdersRouter } from '../modules/orders/orders.routes.js';
import { customerWishlistRouter } from '../modules/customer-wishlist/wishlist.routes.js';
import { customerCartRouter } from '../modules/customer-cart/cart.routes.js';
import { customerPromotionsRouter } from '../modules/customer-promotions/promotions.routes.js';
import { customerAddressesRouter } from '../modules/customer-addresses/addresses.routes.js';
import { customerAddressesController } from '../modules/customer-addresses/addresses.controller.js';
import { customerOrdersRouter } from '../modules/customer-orders/customerOrders.routes.js';
import { paymentModesRouter } from '../modules/payment-modes/paymentModes.routes.js';

export const apiV1Router = Router();

// Mount system and domain routes
apiV1Router.use('/health', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/categories', categoryRouter);
apiV1Router.use('/banners', publicBannersRouter);
apiV1Router.use('/brands', publicBrandsRouter);
apiV1Router.use('/products', publicProductsRouter);
apiV1Router.use('/policies', publicPoliciesRouter);
apiV1Router.use('/catalog', catalogSharedRouter);
apiV1Router.use('/customer/wishlist', customerWishlistRouter);
apiV1Router.use('/customer/cart', customerCartRouter);
apiV1Router.use('/customer/promotions', customerPromotionsRouter);
apiV1Router.use('/customer/addresses', customerAddressesRouter);
apiV1Router.get('/pincode/:pincode', (req, res, next) => customerAddressesController.lookupPincode(req, res, next));
apiV1Router.use('/customer/orders', customerOrdersRouter);
apiV1Router.use('/payment-modes', paymentModesRouter);
apiV1Router.use('/seller/onboarding', sellerOnboardingRouter);
apiV1Router.use('/seller/warehouses', sellerWarehousesRouter);
apiV1Router.use('/seller/dashboard', sellerDashboardRouter);
apiV1Router.use('/seller/catalog', sellerCatalogRouter);
apiV1Router.use('/seller/inventory', sellerInventoryRouter);
apiV1Router.use('/seller/orders', sellerOrdersRouter);
apiV1Router.use('/admin/sellers', adminSellersRouter);
apiV1Router.use('/admin/categories', adminCategoryRouter);
apiV1Router.use('/admin/brands', adminBrandsRouter);
apiV1Router.use('/admin/banners', adminBannersRouter);
apiV1Router.use('/admin/policies', adminPoliciesRouter);
apiV1Router.use('/admin/dashboard', adminDashboardRouter);
apiV1Router.use('/admin/catalog', catalogMetadataRouter);
apiV1Router.use('/admin/catalog/products', adminCatalogQCRouter);
apiV1Router.use('/warehouses', warehousesRouter);
apiV1Router.use('/content', contentPagesRouter);

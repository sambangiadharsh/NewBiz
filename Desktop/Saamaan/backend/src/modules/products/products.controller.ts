import { Request, Response, NextFunction } from 'express';
import { productsService } from './products.service.js';
import {
  searchCatalogSchema,
  proposeProductSchema,
  addSellerProductSchema,
  onboardSellerProductSchema,
  batchOnboardSellerProductsSchema,
  adminQCReviewSchema,
  adminCreateProductSchema,
  adminAddVariantSchema,
  adminUpdateProductMasterSchema,
  adminUpdateProductVariantSchema,
} from './products.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { BadRequestError } from '../../utils/errors.js';
import { brandsRepository } from '../brands/brands.repository.js';
import { catalogMetadataRepository } from '../admin-catalog/catalogMetadata.repository.js';
import { storageService } from '../../services/storage/StorageService.js';

export class ProductsController {
  /**
   * Helper to extract active sellerId from authenticated merchant.
   */
  private getSellerId(req: Request): string {
    const sellerId = req.user?.sellers?.[0]?.sellerId;
    if (!sellerId) {
      throw new BadRequestError('User is not associated with an active seller profile');
    }
    return sellerId;
  }

  /**
   * GET /api/v1/catalog/categories/:categoryId/attributes
   * Returns strict leaf-level attributes for a category.
   */
  async getCategoryAttributes(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await productsService.getLeafCategoryAttributes(req.params.categoryId);
      sendSuccess(res, data, 'Category attributes fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/catalog/brands
   * Returns active brands for dropdown picker.
   */
  async getBrands(_req: Request, res: Response, next: NextFunction) {
    try {
      const brands = await brandsRepository.list({ status: 'ACTIVE' });

      const formatted = brands.map((b) => ({
        brandId: String(b.BrandID),
        brandName: b.BrandName,
        brandCode: b.BrandCode || b.BrandName.slice(0, 3).toUpperCase(),
        manufacturer: b.Manufacturer,
        imageUrl: b.ImageURL,
        isFeatured: b.IsFeatured,
      }));

      sendSuccess(res, formatted, 'Brands fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/catalog/uoms
   * Returns active units of measure.
   */
  async getUOMs(_req: Request, res: Response, next: NextFunction) {
    try {
      const uoms = await catalogMetadataRepository.listUOMs({ status: 'ACTIVE' });

      const formatted = uoms.map((u) => ({
        uomId: String(u.UOMID),
        uomCode: u.UOMCode,
        uomName: u.UOMName,
        uomType: u.UOMType,
        decimalPrecision: u.DecimalPrecision,
      }));

      sendSuccess(res, formatted, 'UOMs fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/seller/catalog/search
   * Global search across approved products with category authorization check.
   */
  async searchCatalog(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const query = searchCatalogSchema.parse(req.query);
      const data = await productsService.searchApprovedCatalog(sellerId, query);
      sendSuccess(res, data, 'Catalog search results fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/seller/catalog/products
   * Adds commercial listing for an approved variant.
   */
  async createSellerProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const input = addSellerProductSchema.parse(req.body);
      const data = await productsService.createSellerProduct(sellerId, input, req.user!.userId);
      sendSuccess(res, data, 'Product added to seller catalog successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/seller/catalog/products/onboard
   * Production-grade atomic onboarding:
   * Creates SellerProduct + WarehouseProduct(s) + Inventory Shell(s) + InventoryTransaction(s).
   */
  async onboardSellerProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const input = onboardSellerProductSchema.parse(req.body);
      const data = await productsService.onboardSellerProduct(sellerId, input, req.user!.userId);
      sendSuccess(res, data, 'Product successfully listed and assigned to warehouses', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/seller/catalog/products/batch-onboard
   * Production-grade atomic batch multi-variant onboarding.
   */
  async batchOnboardSellerProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const input = batchOnboardSellerProductsSchema.parse(req.body);
      const data = await productsService.batchOnboardSellerProducts(sellerId, input, req.user!.userId);
      sendSuccess(res, data, data.message || 'Variants successfully listed and assigned to warehouses', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/seller/catalog/products/:id/warehouses
   * Assign an existing SellerProduct to additional warehouses.
   */
  async assignSellerProductToWarehouses(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const sellerProductId = req.params.id;
      const { warehouseIds } = req.body;
      if (!Array.isArray(warehouseIds) || warehouseIds.length === 0) {
        throw new BadRequestError('warehouseIds must be a non-empty array of warehouse IDs');
      }
      const data = await productsService.assignSellerProductToWarehouses(
        sellerId,
        sellerProductId,
        warehouseIds.map(String),
        req.user!.userId
      );
      sendSuccess(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/seller/catalog/eligible-warehouses
   * Returns seller's active warehouses with assignment status for a variant.
   */
  async getEligibleWarehouses(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const variantId = req.query.variantId as string | undefined;
      const data = await productsService.listEligibleWarehousesForListing(sellerId, variantId);
      sendSuccess(res, data, 'Eligible warehouses fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/seller/catalog/products
   * Returns seller's commercial listings.
   */
  async getSellerProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const data = await productsService.getSellerProducts(sellerId);
      sendSuccess(res, data, 'Seller products fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/seller/catalog/products/:id/transactions
   * Returns chronological stock movements for this product.
   */
  async getProductTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const sellerProductId = req.params.id;
      const data = await productsService.getProductTransactions(sellerId, sellerProductId);
      sendSuccess(res, data, 'Product inventory transactions fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/seller/catalog/products/:id/pricing
   * Updates selling price, MRP, or status for this listing.
   */
  async updateSellerProductPricing(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const sellerProductId = req.params.id;
      const { sellingPrice, mrp, status, packerName, importerName } = req.body;
      const data = await productsService.updateSellerProductPricing(
        sellerId,
        sellerProductId,
        {
          sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : undefined,
          mrp: mrp !== undefined ? Number(mrp) : undefined,
          status,
          packerName: packerName !== undefined ? (packerName ? String(packerName).trim() : null) : undefined,
          importerName: importerName !== undefined ? (importerName ? String(importerName).trim() : null) : undefined,
        },
        req.user!.userId
      );
      sendSuccess(res, data, 'Product details updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/seller/catalog/propose
   * Proposes a new ProductMaster and ProductVariants for Catalog QC.
   */
  async proposeProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const input = proposeProductSchema.parse(req.body);
      const data = await productsService.proposeProduct(sellerId, input, req.user!.userId);
      sendSuccess(res, data, 'Product proposed successfully for Catalog QC review', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/seller/catalog/upload-asset
   * Uploads a variant product image asset.
   */
  async uploadAsset(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new BadRequestError('Please provide an image file to upload');
      }

      const { relativeUrl, filename } = await storageService.saveFile(req.file, 'product-assets');
      sendSuccess(res, { url: relativeUrl, filename }, 'Asset uploaded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/seller/catalog/proposals
   * Returns proposals submitted by this seller.
   */
  async getSellerProposals(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await productsService.getSellerProposals(req.user!.userId);
      sendSuccess(res, data, 'Seller proposals fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/catalog/qc
   * Admin Catalog QC review queue.
   */
  async getAdminQCQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as string | undefined;
      const q = req.query.q as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const data = await productsService.getAdminQCQueue({ status, q, page, limit });
      sendSuccess(res, data, 'Catalog QC queue fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/catalog/qc/:productId/review
   * Admin approves, requests rework, or rejects proposal.
   */
  async reviewProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const input = adminQCReviewSchema.parse(req.body);
      const data = await productsService.reviewProduct(req.params.productId, req.user!.userId, input);
      sendSuccess(res, data, 'Catalog QC decision recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/catalog/products/create
   * Admin directly creates a verified product with immediate ACTIVE (or DRAFT) status.
   */
  async adminCreateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const input = adminCreateProductSchema.parse(req.body);
      const data = await productsService.adminCreateProduct(input, req.user!.userId);
      sendSuccess(res, data, data.message, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/catalog/products/:productId/variants
   * Admin adds a new variant to an existing ProductMaster.
   */
  async adminAddVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const input = adminAddVariantSchema.parse(req.body);
      const data = await productsService.adminAddVariant(req.params.productId, input, req.user!.userId);
      sendSuccess(res, data, data.message, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/catalog/products/list
   * Admin lists catalog products with pagination, search, and status filtering.
   */
  async getAdminProductsList(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as string | undefined;
      const q = req.query.q as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const data = await productsService.getAdminQCQueue({
        status: status || 'ALL',
        q,
        page,
        limit,
      });
      sendSuccess(res, data, 'Catalog products fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/seller/catalog/categories/:categoryId/apply
   * Seller applies for authorization to list products in a category.
   */
  async applyForCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const sellerId = this.getSellerId(req);
      const categoryId = req.params.categoryId;
      const { remarks } = req.body || {};
      const data = await productsService.applyForCategory(
        sellerId,
        categoryId,
        req.user?.userId,
        remarks
      );
      sendSuccess(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/catalog/products/:productId
   * Admin updates product master details.
   */
  async adminUpdateProductMaster(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = req.params.productId;
      const input = adminUpdateProductMasterSchema.parse(req.body);
      const data = await productsService.adminUpdateProductMaster(
        productId,
        input,
        req.user!.userId
      );
      sendSuccess(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/catalog/products/:productId/variants/:variantId
   * Admin updates product variant details.
   */
  async adminUpdateProductVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, variantId } = req.params;
      const input = adminUpdateProductVariantSchema.parse(req.body);
      const data = await productsService.adminUpdateProductVariant(
        productId,
        variantId,
        input,
        req.user!.userId
      );
      sendSuccess(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/catalog/products/:productId
   * Admin fetches full product master + variants + specifications + assets for editing studio.
   */
  async getAdminProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = req.params.productId;
      const data = await productsService.getAdminProductById(productId);
      sendSuccess(res, data, 'Product details fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const productsController = new ProductsController();

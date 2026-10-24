import { Request, Response, NextFunction } from 'express';
import { brandsService } from './brands.service.js';
import { storageService } from '../../services/storage/index.js';
import { sendSuccess } from '../../utils/response.js';
import { BadRequestError } from '../../utils/errors.js';

export const brandsController = {
  /**
   * GET /api/v1/admin/brands
   */
  async listBrands(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, isFeatured } = req.query;

      const filters: any = {};
      if (typeof search === 'string') filters.search = search;
      if (typeof status === 'string') filters.status = status;
      if (isFeatured !== undefined) {
        filters.isFeatured = isFeatured === 'true' || isFeatured === '1';
      }

      const brands = await brandsService.listBrands(filters);
      sendSuccess(res, brands, 'Brands fetched successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/admin/brands/:id
   */
  async getBrandById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const brand = await brandsService.getBrandById(id);
      sendSuccess(res, brand, 'Brand retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/admin/brands
   */
  async createBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId ? BigInt(req.user.userId) : undefined;
      const brand = await brandsService.createBrand(req.body, userId);
      sendSuccess(res, brand, 'Brand created successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/brands/:id
   */
  async updateBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const userId = req.user?.userId ? BigInt(req.user.userId) : undefined;
      const brand = await brandsService.updateBrand(id, req.body, userId);
      sendSuccess(res, brand, 'Brand updated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/v1/admin/brands/:id/featured
   */
  async toggleFeatured(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const isFeatured = Boolean(req.body.isFeatured);
      const userId = req.user?.userId ? BigInt(req.user.userId) : undefined;
      const result = await brandsService.toggleFeatured(id, isFeatured, userId);
      sendSuccess(res, result, `Brand ${isFeatured ? 'marked as featured' : 'unfeatured'} successfully`);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/v1/admin/brands/:id
   */
  async deleteBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const result = await brandsService.deleteBrand(id);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/admin/brands/upload-image
   */
  async uploadBrandImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new BadRequestError('Please provide an image file to upload');
      }

      const { relativeUrl, filename } = await storageService.saveFile(req.file, 'brand-images');
      sendSuccess(res, { url: relativeUrl, filename }, 'Brand image uploaded successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/admin/brands/:id/products
   */
  async getBrandProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const data = await brandsService.getBrandProducts(id);
      sendSuccess(res, data, 'Brand products fetched successfully');
    } catch (err) {
      next(err);
    }
  },
};

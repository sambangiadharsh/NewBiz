import { Request, Response, NextFunction } from 'express';
import { bannersService } from './banners.service.js';
import { storageService } from '../../services/storage/index.js';
import { sendSuccess } from '../../utils/response.js';
import { BadRequestError } from '../../utils/errors.js';

export const bannersController = {
  /**
   * GET /api/v1/admin/banners
   */
  async listBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, placement, status } = req.query;
      const filters: any = {};
      if (typeof search === 'string') filters.search = search;
      if (typeof placement === 'string') filters.placement = placement;
      if (typeof status === 'string') filters.status = status;

      const banners = await bannersService.listBanners(filters);
      sendSuccess(res, banners, 'Banners fetched successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/admin/banners/:id
   */
  async getBannerById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const banner = await bannersService.getBannerById(id);
      sendSuccess(res, banner, 'Banner details fetched successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/admin/banners
   */
  async createBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId ? BigInt(req.user.userId) : undefined;
      const banner = await bannersService.createBanner(req.body, userId);
      sendSuccess(res, banner, 'Banner created successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/banners/:id
   */
  async updateBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const userId = req.user?.userId ? BigInt(req.user.userId) : undefined;
      const banner = await bannersService.updateBanner(id, req.body, userId);
      sendSuccess(res, banner, 'Banner updated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/v1/admin/banners/:id/status
   */
  async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const userId = req.user?.userId ? BigInt(req.user.userId) : undefined;
      const { status } = req.body;
      if (!status) throw new BadRequestError('Status is required');

      const result = await bannersService.toggleStatus(id, status, userId);
      sendSuccess(res, result, 'Banner status updated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/v1/admin/banners/:id
   */
  async deleteBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const id = BigInt(req.params.id);
      const result = await bannersService.deleteBanner(id);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/admin/banners/upload-image
   */
  async uploadBannerImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new BadRequestError('Please provide an image file to upload');
      }

      const { relativeUrl, filename } = await storageService.saveFile(req.file, 'banner-images');
      sendSuccess(res, { url: relativeUrl, filename }, 'Banner image uploaded successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/banners (Public storefront endpoint)
   */
  async listPublicBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const { placement } = req.query;
      const banners = await bannersService.listPublicBanners(
        typeof placement === 'string' ? placement : undefined
      );
      sendSuccess(res, banners, 'Active storefront banners fetched successfully');
    } catch (err) {
      next(err);
    }
  },
};

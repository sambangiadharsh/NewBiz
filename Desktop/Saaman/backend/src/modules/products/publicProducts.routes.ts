import { Router, Request, Response, NextFunction } from 'express';
import { publicProductsService } from './publicProducts.service.js';
import { sendSuccess } from '../../utils/response.js';

export const publicProductsRouter = Router();

/**
 * GET /api/v1/products
 * Public customer storefront endpoint listing active catalog products.
 */
publicProductsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, brandId, q, limit } = req.query;
    const data = await publicProductsService.getStorefrontProducts({
      category: category ? String(category) : undefined,
      brandId: brandId ? String(brandId) : undefined,
      q: q ? String(q) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    sendSuccess(res, data, 'Storefront products fetched successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/products/:id
 * Public customer storefront endpoint for complete product detail.
 */
publicProductsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await publicProductsService.getStorefrontProductById(req.params.id);
    sendSuccess(res, data, 'Product details fetched successfully');
  } catch (error) {
    next(error);
  }
});







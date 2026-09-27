import { Request, Response, NextFunction } from 'express';
import { categoryService } from './category.service.js';
import { sendSuccess } from '../../utils/response.js';
import {
  createCategorySchema,
  updateCategorySchema,
  linkCategoryDocumentSchema,
  createDocumentTypeSchema,
  linkCategoryAttributeSchema,
} from './category.validation.js';

/**
 * GET /api/v1/categories
 * Public / seller dropdown of active categories.
 */
export const getCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.getPublicCategories();
    return sendSuccess(res, data, 'Categories fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/categories/:id/documents
 * Public / seller list of required documents for a category.
 */
export const getCategoryDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.getCategoryDocuments(req.params.id);
    return sendSuccess(res, data, 'Category document requirements fetched');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/categories
 * Admin: Full category list with metrics, search, and status filtering.
 */
export const getAdminCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const data = await categoryService.getAdminCategories({ status, search });
    return sendSuccess(res, data, 'Admin categories fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/categories
 * Admin: Create a new category.
 */
export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createCategorySchema.parse(req.body);
    const data = await categoryService.createCategory(input, req.user!.userId);
    return sendSuccess(res, data, 'Category created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/admin/categories/:id
 * Admin: Update category details.
 */
export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateCategorySchema.parse(req.body);
    const data = await categoryService.updateCategory(req.params.id, input, req.user!.userId);
    return sendSuccess(res, data, 'Category updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/categories/:id/documents
 * Admin: View documents linked to a category.
 */
export const getAdminCategoryDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.getCategoryDocuments(req.params.id);
    return sendSuccess(res, data, 'Category documents fetched');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/categories/:id/documents
 * Admin: Link a document type requirement to a category.
 */
export const linkCategoryDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = linkCategoryDocumentSchema.parse(req.body);
    const data = await categoryService.linkCategoryDocument(req.params.id, input, req.user!.userId);
    return sendSuccess(res, data, 'Document requirement linked to category successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/admin/categories/:id/documents/:documentTypeId
 * Admin: Remove a document requirement from a category.
 */
export const removeCategoryDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docTypeId = parseInt(req.params.documentTypeId, 10);
    const data = await categoryService.removeCategoryDocument(req.params.id, docTypeId);
    return sendSuccess(res, data, 'Document requirement removed from category');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/categories/document-types
 * Admin: List all registered document types.
 */
export const getDocumentTypes = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.getDocumentTypes();
    return sendSuccess(res, data, 'Document types fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/categories/document-types
 * Admin: Register a new document type.
 */
export const createDocumentType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createDocumentTypeSchema.parse(req.body);
    const data = await categoryService.createDocumentType(input);
    return sendSuccess(res, data, 'Document type created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/categories/:id/attributes
 * Admin: List all attributes (both inherited and direct) for a category.
 */
export const getAdminCategoryAttributes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.getCategoryAttributes(req.params.id);
    return sendSuccess(res, data, 'Category attributes fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/categories/:id/attributes
 * Admin: Link or update an attribute on a category.
 */
export const linkCategoryAttribute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = linkCategoryAttributeSchema.parse(req.body);
    const data = await categoryService.linkCategoryAttribute(req.params.id, input, req.user!.userId);
    return sendSuccess(res, data, 'Attribute linked to category successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/admin/categories/:id/attributes/:attributeId
 * Admin: Remove a direct attribute from a category.
 */
export const removeCategoryAttribute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.removeCategoryAttribute(req.params.id, req.params.attributeId);
    return sendSuccess(res, data, 'Attribute removed from category successfully');
  } catch (error) {
    next(error);
  }
};

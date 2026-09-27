import { Router } from 'express';
import {
  getCategories,
  getCategoryDocuments,
  getAdminCategories,
  createCategory,
  updateCategory,
  getAdminCategoryDocuments,
  linkCategoryDocument,
  removeCategoryDocument,
  getDocumentTypes,
  createDocumentType,
  getAdminCategoryAttributes,
  linkCategoryAttribute,
  removeCategoryAttribute,
} from './category.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';

export const categoryRouter = Router();

// Public / Seller Category endpoints
categoryRouter.get('/', getCategories);
categoryRouter.get('/:id/documents', getCategoryDocuments);

// Admin Category & Document Management endpoints
export const adminCategoryRouter = Router();
adminCategoryRouter.use(authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'));

adminCategoryRouter.get('/', getAdminCategories);
adminCategoryRouter.post('/', createCategory);
adminCategoryRouter.put('/:id', updateCategory);

// Document types registry
adminCategoryRouter.get('/document-types', getDocumentTypes);
adminCategoryRouter.post('/document-types', createDocumentType);

// Category document requirements
adminCategoryRouter.get('/:id/documents', getAdminCategoryDocuments);
adminCategoryRouter.post('/:id/documents', linkCategoryDocument);
adminCategoryRouter.delete('/:id/documents/:documentTypeId', removeCategoryDocument);

// Category attribute requirements (inherited + direct)
adminCategoryRouter.get('/:id/attributes', getAdminCategoryAttributes);
adminCategoryRouter.post('/:id/attributes', linkCategoryAttribute);
adminCategoryRouter.delete('/:id/attributes/:attributeId', removeCategoryAttribute);

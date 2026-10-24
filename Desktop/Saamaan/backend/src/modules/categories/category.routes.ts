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
  uploadCategoryImage,
} from './category.controller.js';
import { authenticate, requireAccess } from '../../middleware/auth.js';
import { categoryImageUpload } from '../../services/storage/StorageService.js';

export const categoryRouter = Router();

// Public / Seller Category endpoints
categoryRouter.get('/', getCategories);
categoryRouter.get('/:id/documents', getCategoryDocuments);

// Admin Category & Document Management endpoints
export const adminCategoryRouter = Router();
adminCategoryRouter.use(
  authenticate,
  requireAccess({
    roles: ['SUPER_ADMIN', 'ADMIN'],
    permissions: ['catalog.read', 'catalog.manage'],
  })
);

// Image upload endpoint (accepts 'image' or 'file')
adminCategoryRouter.post(
  '/upload-image',
  (req, res, next) => {
    categoryImageUpload.fields([
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
  uploadCategoryImage
);

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

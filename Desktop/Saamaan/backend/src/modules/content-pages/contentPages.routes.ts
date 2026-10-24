import { Router } from 'express';
import { authenticate, requireAccess } from '../../middleware/auth.js';
import { contentPagesController } from './contentPages.controller.js';

export const contentPagesRouter = Router();

// =====================================================
// PUBLIC ROUTES (no auth required)
// Consumed by customer portal via API
// =====================================================

// GET /api/v1/content/pages — list all published pages (for nav/footer links)
contentPagesRouter.get('/pages', (req, res, next) =>
  contentPagesController.listPublishedPages(req, res, next)
);

// GET /api/v1/content/pages/:slug — get full page content by slug
contentPagesRouter.get('/pages/:slug', (req, res, next) =>
  contentPagesController.getPublishedPageBySlug(req, res, next)
);

// GET /api/v1/content/faqs — public FAQs with sections
contentPagesRouter.get('/faqs', (req, res, next) =>
  contentPagesController.getPublicFAQs(req, res, next)
);

// GET /api/v1/content/contact — public contact info
contentPagesRouter.get('/contact', (req, res, next) =>
  contentPagesController.getPublicContactInfo(req, res, next)
);

// POST /api/v1/content/contact/inquiry — submit contact inquiry
contentPagesRouter.post('/contact/inquiry', (req, res, next) =>
  contentPagesController.submitContactInquiry(req, res, next)
);

// GET /api/v1/content/social-links — public social links
contentPagesRouter.get('/social-links', (req, res, next) =>
  contentPagesController.getPublicSocialLinks(req, res, next)
);

// =====================================================
// ADMIN ROUTES (require authentication + ADMIN role)
// =====================================================

const adminRouter = Router();
adminRouter.use(
  authenticate,
  requireAccess({
    roles: ['SUPER_ADMIN', 'ADMIN'],
    permissions: ['catalog.manage', 'catalog.read'],
  })
);

// --- CMS Pages ---
adminRouter.get('/pages', (req, res, next) =>
  contentPagesController.adminListAllPages(req, res, next)
);

adminRouter.get('/pages/:id', (req, res, next) =>
  contentPagesController.adminGetPageById(req, res, next)
);

adminRouter.post('/pages', (req, res, next) =>
  contentPagesController.createPage(req, res, next)
);

adminRouter.put('/pages/:id', (req, res, next) =>
  contentPagesController.updatePage(req, res, next)
);

adminRouter.delete('/pages/:id', (req, res, next) =>
  contentPagesController.deletePage(req, res, next)
);

// --- FAQ Sections ---
adminRouter.get('/faqs', (req, res, next) =>
  contentPagesController.adminListFAQSections(req, res, next)
);

adminRouter.post('/faqs/sections', (req, res, next) =>
  contentPagesController.createFAQSection(req, res, next)
);

adminRouter.put('/faqs/sections/:sectionId', (req, res, next) =>
  contentPagesController.updateFAQSection(req, res, next)
);

adminRouter.delete('/faqs/sections/:sectionId', (req, res, next) =>
  contentPagesController.deleteFAQSection(req, res, next)
);

// --- FAQ Items ---
adminRouter.post('/faqs/sections/:sectionId/items', (req, res, next) =>
  contentPagesController.createFAQItem(req, res, next)
);

adminRouter.put('/faqs/items/:itemId', (req, res, next) =>
  contentPagesController.updateFAQItem(req, res, next)
);

adminRouter.delete('/faqs/items/:itemId', (req, res, next) =>
  contentPagesController.deleteFAQItem(req, res, next)
);

// --- Contact Info ---
adminRouter.get('/contact', (req, res, next) =>
  contentPagesController.adminGetContactInfo(req, res, next)
);

adminRouter.put('/contact', (req, res, next) =>
  contentPagesController.upsertContactInfo(req, res, next)
);

// --- Social Links ---
adminRouter.get('/social-links', (req, res, next) =>
  contentPagesController.adminListSocialLinks(req, res, next)
);

adminRouter.put('/social-links', (req, res, next) =>
  contentPagesController.upsertSocialLink(req, res, next)
);

adminRouter.delete('/social-links/:linkId', (req, res, next) =>
  contentPagesController.deleteSocialLink(req, res, next)
);

// Mount admin sub-router under /admin
contentPagesRouter.use('/admin', adminRouter);

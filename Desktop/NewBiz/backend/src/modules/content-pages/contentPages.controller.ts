import { Request, Response, NextFunction } from 'express';
import { contentPagesService } from './contentPages.service.js';
import {
  createPageSchema,
  updatePageSchema,
  createFAQSectionSchema,
  updateFAQSectionSchema,
  createFAQItemSchema,
  updateFAQItemSchema,
  upsertContactInfoSchema,
  upsertSocialLinkSchema,
} from './contentPages.validation.js';
import { ValidationError } from '../../utils/errors.js';

function validateOrThrow<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err: any) {
    throw new ValidationError('Validation failed', err.errors ?? err.message);
  }
}

export const contentPagesController = {
  // ==============================
  // CMS PAGES
  // ==============================

  async listPublishedPages(_req: Request, res: Response, next: NextFunction) {
    try {
      const pages = await contentPagesService.listPublishedPages();
      res.json({ success: true, data: pages });
    } catch (err) {
      next(err);
    }
  },

  async getPublishedPageBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const page = await contentPagesService.getPublishedPageBySlug(req.params.slug);
      res.json({ success: true, data: page });
    } catch (err) {
      next(err);
    }
  },

  async adminListAllPages(_req: Request, res: Response, next: NextFunction) {
    try {
      const pages = await contentPagesService.adminListAllPages();
      res.json({ success: true, data: pages });
    } catch (err) {
      next(err);
    }
  },

  async adminGetPageById(req: Request, res: Response, next: NextFunction) {
    try {
      const page = await contentPagesService.adminGetPageById(BigInt(req.params.id));
      res.json({ success: true, data: page });
    } catch (err) {
      next(err);
    }
  },

  async createPage(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = validateOrThrow(createPageSchema, req.body);
      const page = await contentPagesService.createPage(
        {
          pageType: validated.pageType,
          title: validated.title,
          slug: validated.slug,
          content: validated.content,
          status: validated.status,
          metaTitle: validated.metaTitle,
          metaDescription: validated.metaDescription,
          isSystemPage: validated.isSystemPage,
        },
        BigInt(req.user!.userId)
      );
      res.status(201).json({ success: true, data: page });
    } catch (err) {
      next(err);
    }
  },

  async updatePage(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = validateOrThrow(updatePageSchema, req.body);
      const page = await contentPagesService.updatePage(
        BigInt(req.params.id),
        {
          title: validated.title,
          slug: validated.slug,
          content: validated.content,
          status: validated.status,
          metaTitle: validated.metaTitle ?? undefined,
          metaDescription: validated.metaDescription ?? undefined,
        },
        BigInt(req.user!.userId)
      );
      res.json({ success: true, data: page });
    } catch (err) {
      next(err);
    }
  },

  async deletePage(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await contentPagesService.deletePage(BigInt(req.params.id));
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  // ==============================
  // FAQ SECTIONS
  // ==============================

  async getPublicFAQs(_req: Request, res: Response, next: NextFunction) {
    try {
      const faqs = await contentPagesService.getPublicFAQs();
      res.json({ success: true, data: faqs });
    } catch (err) {
      next(err);
    }
  },

  async adminListFAQSections(_req: Request, res: Response, next: NextFunction) {
    try {
      const sections = await contentPagesService.adminListFAQSections();
      res.json({ success: true, data: sections });
    } catch (err) {
      next(err);
    }
  },

  async createFAQSection(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = validateOrThrow(createFAQSectionSchema, req.body);
      const section = await contentPagesService.createFAQSection(
        validated,
        BigInt(req.user!.userId)
      );
      res.status(201).json({ success: true, data: section });
    } catch (err) {
      next(err);
    }
  },

  async updateFAQSection(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = validateOrThrow(updateFAQSectionSchema, req.body);
      const section = await contentPagesService.updateFAQSection(
        BigInt(req.params.sectionId),
        validated,
        BigInt(req.user!.userId)
      );
      res.json({ success: true, data: section });
    } catch (err) {
      next(err);
    }
  },

  async deleteFAQSection(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await contentPagesService.deleteFAQSection(BigInt(req.params.sectionId));
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  // ==============================
  // FAQ ITEMS
  // ==============================

  async createFAQItem(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = validateOrThrow(createFAQItemSchema, req.body);
      const item = await contentPagesService.createFAQItem(
        BigInt(req.params.sectionId),
        validated,
        BigInt(req.user!.userId)
      );
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  },

  async updateFAQItem(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = validateOrThrow(updateFAQItemSchema, req.body);
      const item = await contentPagesService.updateFAQItem(
        BigInt(req.params.itemId),
        validated,
        BigInt(req.user!.userId)
      );
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  },

  async deleteFAQItem(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await contentPagesService.deleteFAQItem(BigInt(req.params.itemId));
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  // ==============================
  // CONTACT INFO
  // ==============================

  async getPublicContactInfo(_req: Request, res: Response, next: NextFunction) {
    try {
      const info = await contentPagesService.getPublicContactInfo();
      res.json({ success: true, data: info });
    } catch (err) {
      next(err);
    }
  },

  async submitContactInquiry(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, subject, message } = req.body;
      if (!name || !email || !message) {
        res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
        return;
      }
      const result = await contentPagesService.submitContactInquiry({ name, email, subject, message });
      res.status(201).json({
        success: true,
        data: result,
        message: 'Your message has been received. Our concierge team will reply within 24 hours.',
      });
    } catch (err) {
      next(err);
    }
  },

  async adminGetContactInfo(_req: Request, res: Response, next: NextFunction) {
    try {
      const info = await contentPagesService.adminGetContactInfo();
      res.json({ success: true, data: info });
    } catch (err) {
      next(err);
    }
  },

  async upsertContactInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = validateOrThrow(upsertContactInfoSchema, req.body);
      const email = (validated.email ?? validated.Email)!;
      const phone = validated.phone !== undefined ? validated.phone : validated.Phone;
      const supportPhone = validated.supportPhone !== undefined ? validated.supportPhone : validated.SupportPhone;
      const addressLine1 = validated.addressLine1 !== undefined ? validated.addressLine1 : validated.AddressLine1;
      const addressLine2 = validated.addressLine2 !== undefined ? validated.addressLine2 : validated.AddressLine2;
      const city = validated.city !== undefined ? validated.city : validated.City;
      const state = validated.state !== undefined ? validated.state : validated.State;
      const country = validated.country !== undefined ? validated.country : validated.Country;
      const postalCode = validated.postalCode !== undefined ? validated.postalCode : validated.PostalCode;
      const businessHours = validated.businessHours !== undefined ? validated.businessHours : validated.BusinessHours;
      const mapEmbedURL = validated.mapEmbedURL !== undefined ? validated.mapEmbedURL : validated.MapEmbedURL;

      const info = await contentPagesService.upsertContactInfo(
        {
          email,
          phone: phone ?? undefined,
          supportPhone: supportPhone ?? undefined,
          addressLine1: addressLine1 ?? undefined,
          addressLine2: addressLine2 ?? undefined,
          city: city ?? undefined,
          state: state ?? undefined,
          country: country ?? undefined,
          postalCode: postalCode ?? undefined,
          businessHours: businessHours ?? undefined,
          mapEmbedURL: mapEmbedURL ?? undefined,
        },
        BigInt(req.user!.userId)
      );
      res.json({ success: true, data: info });
    } catch (err) {
      next(err);
    }
  },

  // ==============================
  // SOCIAL LINKS
  // ==============================

  async getPublicSocialLinks(_req: Request, res: Response, next: NextFunction) {
    try {
      const links = await contentPagesService.getPublicSocialLinks();
      res.json({ success: true, data: links });
    } catch (err) {
      next(err);
    }
  },

  async adminListSocialLinks(_req: Request, res: Response, next: NextFunction) {
    try {
      const links = await contentPagesService.adminListSocialLinks();
      res.json({ success: true, data: links });
    } catch (err) {
      next(err);
    }
  },

  async upsertSocialLink(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = validateOrThrow(upsertSocialLinkSchema, req.body);
      const link = await contentPagesService.upsertSocialLink(
        {
          platform: validated.platform,
          label: validated.label,
          url: validated.url,
          iconName: validated.iconName ?? undefined,
          displayOrder: validated.displayOrder,
          isActive: validated.isActive,
        },
        BigInt(req.user!.userId)
      );
      res.json({ success: true, data: link });
    } catch (err) {
      next(err);
    }
  },

  async deleteSocialLink(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await contentPagesService.deleteSocialLink(BigInt(req.params.linkId));
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
};

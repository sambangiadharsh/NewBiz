import { prisma } from '../../database/prisma.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors.js';
import { mailService } from '../../utils/mailService.js';
import { config } from '../../config/index.js';

// =====================================================
// CMS Pages (Privacy Policy, Terms, Cookie, About, etc.)
// =====================================================

const SYSTEM_PAGE_TYPES = [
  'PRIVACY_POLICY',
  'TERMS_OF_SERVICE',
  'COOKIE_POLICY',
  'ABOUT_US',
  'CAREERS',
  'RETURN_POLICY',
  'SHIPPING_POLICY',
];

export const contentPagesService = {
  // Public: Get all published pages (for customer portal nav/footer)
  async listPublishedPages() {
    return prisma.cMSPages.findMany({
      where: { Status: 'PUBLISHED' },
      select: {
        PageID: true,
        PageType: true,
        Title: true,
        Slug: true,
        MetaTitle: true,
        MetaDescription: true,
        IsSystemPage: true,
        UpdatedAt: true,
      },
      orderBy: { Title: 'asc' },
    });
  },

  // Public: Get a single published page by slug
  async getPublishedPageBySlug(slug: string) {
    const page = await prisma.cMSPages.findFirst({
      where: { Slug: slug, Status: 'PUBLISHED' },
      select: {
        PageID: true,
        PageType: true,
        Title: true,
        Slug: true,
        Content: true,
        MetaTitle: true,
        MetaDescription: true,
        IsSystemPage: true,
        UpdatedAt: true,
        Users_CMSPages_UpdatedByToUsers: {
          select: { FirstName: true, LastName: true },
        },
      },
    });

    if (!page) throw new NotFoundError(`Page with slug "${slug}" not found or not published`);
    return page;
  },

  // Admin: List all pages (includes drafts)
  async adminListAllPages() {
    return prisma.cMSPages.findMany({
      select: {
        PageID: true,
        PageType: true,
        Title: true,
        Slug: true,
        Status: true,
        IsSystemPage: true,
        MetaTitle: true,
        MetaDescription: true,
        CreatedAt: true,
        UpdatedAt: true,
        Users_CMSPages_CreatedByToUsers: {
          select: { FirstName: true, LastName: true, Email: true },
        },
        Users_CMSPages_UpdatedByToUsers: {
          select: { FirstName: true, LastName: true, Email: true },
        },
      },
      orderBy: [{ PageType: 'asc' }, { CreatedAt: 'desc' }],
    });
  },

  // Admin: Get full page by ID
  async adminGetPageById(pageId: bigint) {
    const page = await prisma.cMSPages.findUnique({
      where: { PageID: pageId },
    });
    if (!page) throw new NotFoundError('CMS page not found');
    return page;
  },

  // Admin: Create a new CMS page
  async createPage(
    data: {
      pageType: string;
      title: string;
      slug: string;
      content: string;
      status: string;
      metaTitle?: string;
      metaDescription?: string;
      isSystemPage?: boolean;
    },
    createdBy: bigint
  ) {
    // Validate slug uniqueness
    const existing = await prisma.cMSPages.findFirst({ where: { Slug: data.slug } });
    if (existing) throw new ConflictError(`A page with slug "${data.slug}" already exists`);

    // Enforce one system page per type
    if (data.isSystemPage && SYSTEM_PAGE_TYPES.includes(data.pageType)) {
      const existingSystemPage = await prisma.cMSPages.findFirst({
        where: { PageType: data.pageType, IsSystemPage: true },
      });
      if (existingSystemPage) {
        throw new ConflictError(
          `A system page of type "${data.pageType}" already exists. Update the existing one instead.`
        );
      }
    }

    return prisma.cMSPages.create({
      data: {
        PageType: data.pageType.toUpperCase(),
        Title: data.title,
        Slug: data.slug,
        Content: data.content,
        Status: data.status,
        MetaTitle: data.metaTitle,
        MetaDescription: data.metaDescription,
        IsSystemPage: data.isSystemPage ?? SYSTEM_PAGE_TYPES.includes(data.pageType.toUpperCase()),
        CreatedAt: new Date(),
        CreatedBy: createdBy,
      },
    });
  },

  // Admin: Update a CMS page (Tiptap JSON stored as stringified JSON or HTML)
  async updatePage(
    pageId: bigint,
    data: {
      title?: string;
      slug?: string;
      content?: string;
      status?: string;
      metaTitle?: string;
      metaDescription?: string;
    },
    updatedBy: bigint
  ) {
    const page = await prisma.cMSPages.findUnique({ where: { PageID: pageId } });
    if (!page) throw new NotFoundError('CMS page not found');

    // Check slug collision (excluding self)
    if (data.slug && data.slug !== page.Slug) {
      const collision = await prisma.cMSPages.findFirst({
        where: { Slug: data.slug, PageID: { not: pageId } },
      });
      if (collision) throw new ConflictError(`Slug "${data.slug}" is already in use by another page`);
    }

    return prisma.cMSPages.update({
      where: { PageID: pageId },
      data: {
        ...(data.title && { Title: data.title }),
        ...(data.slug && { Slug: data.slug }),
        ...(data.content !== undefined && { Content: data.content }),
        ...(data.status && { Status: data.status }),
        ...(data.metaTitle !== undefined && { MetaTitle: data.metaTitle }),
        ...(data.metaDescription !== undefined && { MetaDescription: data.metaDescription }),
        UpdatedAt: new Date(),
        UpdatedBy: updatedBy,
      },
    });
  },

  // Admin: Delete a non-system CMS page
  async deletePage(pageId: bigint) {
    const page = await prisma.cMSPages.findUnique({ where: { PageID: pageId } });
    if (!page) throw new NotFoundError('CMS page not found');
    if (page.IsSystemPage) {
      throw new BadRequestError('System pages cannot be deleted. You may archive them instead by setting status to ARCHIVED.');
    }
    await prisma.cMSPages.delete({ where: { PageID: pageId } });
    return { message: 'Page deleted successfully' };
  },

  // =====================================================
  // FAQ Sections & Items
  // =====================================================

  // Public: All active FAQ sections with items
  async getPublicFAQs() {
    return prisma.fAQSections.findMany({
      where: { Status: 'ACTIVE' },
      include: {
        FAQItems: {
          where: { Status: 'ACTIVE' },
          orderBy: { DisplayOrder: 'asc' },
          select: {
            FAQItemID: true,
            Question: true,
            Answer: true,
            DisplayOrder: true,
          },
        },
      },
      orderBy: { DisplayOrder: 'asc' },
    });
  },

  // Admin: All FAQ sections with all items (including inactive)
  async adminListFAQSections() {
    return prisma.fAQSections.findMany({
      include: {
        FAQItems: {
          orderBy: { DisplayOrder: 'asc' },
        },
      },
      orderBy: { DisplayOrder: 'asc' },
    });
  },

  // Admin: Create FAQ Section
  async createFAQSection(
    data: { title: string; slug: string; displayOrder?: number },
    createdBy: bigint
  ) {
    const existing = await prisma.fAQSections.findFirst({ where: { Slug: data.slug } });
    if (existing) throw new ConflictError(`FAQ section slug "${data.slug}" already exists`);

    return prisma.fAQSections.create({
      data: {
        Title: data.title,
        Slug: data.slug,
        DisplayOrder: data.displayOrder ?? 0,
        Status: 'ACTIVE',
        CreatedAt: new Date(),
        CreatedBy: createdBy,
      },
    });
  },

  // Admin: Update FAQ Section
  async updateFAQSection(
    sectionId: bigint,
    data: { title?: string; displayOrder?: number; status?: string },
    updatedBy: bigint
  ) {
    const sec = await prisma.fAQSections.findUnique({ where: { FAQSectionID: sectionId } });
    if (!sec) throw new NotFoundError('FAQ section not found');

    return prisma.fAQSections.update({
      where: { FAQSectionID: sectionId },
      data: {
        ...(data.title && { Title: data.title }),
        ...(data.displayOrder !== undefined && { DisplayOrder: data.displayOrder }),
        ...(data.status && { Status: data.status }),
        UpdatedAt: new Date(),
        UpdatedBy: updatedBy,
      },
    });
  },

  // Admin: Delete FAQ Section (and its items via cascade)
  async deleteFAQSection(sectionId: bigint) {
    const sec = await prisma.fAQSections.findUnique({ where: { FAQSectionID: sectionId } });
    if (!sec) throw new NotFoundError('FAQ section not found');
    // Delete items first (no cascade in SQL Server by default)
    await prisma.fAQItems.deleteMany({ where: { FAQSectionID: sectionId } });
    await prisma.fAQSections.delete({ where: { FAQSectionID: sectionId } });
    return { message: 'FAQ section and its items deleted' };
  },

  // Admin: Create FAQ Item
  async createFAQItem(
    sectionId: bigint,
    data: { question: string; answer: string; displayOrder?: number },
    createdBy: bigint
  ) {
    const sec = await prisma.fAQSections.findUnique({ where: { FAQSectionID: sectionId } });
    if (!sec) throw new NotFoundError('FAQ section not found');

    return prisma.fAQItems.create({
      data: {
        FAQSectionID: sectionId,
        Question: data.question,
        Answer: data.answer,
        DisplayOrder: data.displayOrder ?? 0,
        Status: 'ACTIVE',
        CreatedAt: new Date(),
        CreatedBy: createdBy,
      },
    });
  },

  // Admin: Update FAQ Item
  async updateFAQItem(
    itemId: bigint,
    data: { question?: string; answer?: string; displayOrder?: number; status?: string },
    updatedBy: bigint
  ) {
    const item = await prisma.fAQItems.findUnique({ where: { FAQItemID: itemId } });
    if (!item) throw new NotFoundError('FAQ item not found');

    return prisma.fAQItems.update({
      where: { FAQItemID: itemId },
      data: {
        ...(data.question && { Question: data.question }),
        ...(data.answer !== undefined && { Answer: data.answer }),
        ...(data.displayOrder !== undefined && { DisplayOrder: data.displayOrder }),
        ...(data.status && { Status: data.status }),
        UpdatedAt: new Date(),
        UpdatedBy: updatedBy,
      },
    });
  },

  // Admin: Delete FAQ Item
  async deleteFAQItem(itemId: bigint) {
    const item = await prisma.fAQItems.findUnique({ where: { FAQItemID: itemId } });
    if (!item) throw new NotFoundError('FAQ item not found');
    await prisma.fAQItems.delete({ where: { FAQItemID: itemId } });
    return { message: 'FAQ item deleted' };
  },

  // =====================================================
  // Contact Info (singleton - one active record)
  // =====================================================

  async getPublicContactInfo() {
    return prisma.contactInfo.findFirst({
      where: { IsActive: true },
      select: {
        ContactInfoID: true,
        Email: true,
        Phone: true,
        SupportPhone: true,
        AddressLine1: true,
        AddressLine2: true,
        City: true,
        State: true,
        Country: true,
        PostalCode: true,
        BusinessHours: true,
        MapEmbedURL: true,
      },
    });
  },

  async adminGetContactInfo() {
    const info = await prisma.contactInfo.findFirst({ where: { IsActive: true } });
    if (!info) return null;
    return {
      ...info,
      ContactInfoID: String(info.ContactInfoID),
      CreatedBy: info.CreatedBy ? String(info.CreatedBy) : null,
      UpdatedBy: info.UpdatedBy ? String(info.UpdatedBy) : null,
    };
  },

  async submitContactInquiry(data: { name: string; email: string; subject?: string; message: string }) {
    const contact = await prisma.contactInfo.findFirst({ where: { IsActive: true } });
    const recipient = contact?.Email || config.SMTP_EMAIL || 'support@hesaathi.com';
    const referenceId = `INQ-${Date.now().toString(36).toUpperCase()}`;

    console.log(
      `[Contact Inquiry Received] Ref: ${referenceId} | From: "${data.name}" <${data.email}> | Subject: "${data.subject || 'General Inquiry'}" | Dest: ${recipient}`
    );

    // 1. Dispatch full inquiry details to support desk with customer reply-to
    await mailService.sendInquiryToSupport({
      recipientEmail: recipient,
      referenceId,
      senderName: data.name,
      senderEmail: data.email,
      subject: data.subject,
      message: data.message,
    });

    // 2. Dispatch automated confirmation receipt to customer
    await mailService.sendInquiryReceiptToCustomer({
      customerEmail: data.email,
      customerName: data.name,
      referenceId,
      subject: data.subject,
    });

    return {
      referenceId,
      receivedAt: new Date().toISOString(),
      recipientEmail: recipient,
    };
  },

  async upsertContactInfo(
    data: {
      email: string;
      phone?: string;
      supportPhone?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      businessHours?: string;
      mapEmbedURL?: string;
    },
    userId: bigint
  ) {
    const existing = await prisma.contactInfo.findFirst({ where: { IsActive: true } });

    let savedInfo;
    if (existing) {
      savedInfo = await prisma.contactInfo.update({
        where: { ContactInfoID: existing.ContactInfoID },
        data: {
          Email: data.email,
          Phone: data.phone,
          SupportPhone: data.supportPhone,
          AddressLine1: data.addressLine1,
          AddressLine2: data.addressLine2,
          City: data.city,
          State: data.state,
          Country: data.country,
          PostalCode: data.postalCode,
          BusinessHours: data.businessHours,
          MapEmbedURL: data.mapEmbedURL,
          UpdatedAt: new Date(),
          UpdatedBy: userId,
        },
      });
    } else {
      savedInfo = await prisma.contactInfo.create({
        data: {
          Email: data.email,
          Phone: data.phone,
          SupportPhone: data.supportPhone,
          AddressLine1: data.addressLine1,
          AddressLine2: data.addressLine2,
          City: data.city,
          State: data.state,
          Country: data.country,
          PostalCode: data.postalCode,
          BusinessHours: data.businessHours,
          MapEmbedURL: data.mapEmbedURL,
          IsActive: true,
          CreatedAt: new Date(),
          CreatedBy: userId,
        },
      });
    }

    return {
      ...savedInfo,
      ContactInfoID: String(savedInfo.ContactInfoID),
      CreatedBy: savedInfo.CreatedBy ? String(savedInfo.CreatedBy) : null,
      UpdatedBy: savedInfo.UpdatedBy ? String(savedInfo.UpdatedBy) : null,
    };
  },

  // =====================================================
  // Social Links
  // =====================================================

  async getPublicSocialLinks() {
    const links = await prisma.socialLinks.findMany({
      where: { IsActive: true },
      select: {
        SocialLinkID: true,
        Platform: true,
        Label: true,
        URL: true,
        IconName: true,
        DisplayOrder: true,
      },
      orderBy: { DisplayOrder: 'asc' },
    });
    return links.map((l) => ({
      ...l,
      SocialLinkID: String(l.SocialLinkID),
    }));
  },

  async adminListSocialLinks() {
    const links = await prisma.socialLinks.findMany({
      orderBy: { DisplayOrder: 'asc' },
    });
    return links.map((l) => ({
      ...l,
      SocialLinkID: String(l.SocialLinkID),
      CreatedBy: l.CreatedBy ? String(l.CreatedBy) : null,
      UpdatedBy: l.UpdatedBy ? String(l.UpdatedBy) : null,
    }));
  },

  async upsertSocialLink(
    data: {
      platform: string;
      label: string;
      url: string;
      iconName?: string;
      displayOrder?: number;
      isActive?: boolean;
    },
    userId: bigint
  ) {
    const existing = await prisma.socialLinks.findFirst({
      where: { Platform: data.platform.toUpperCase() },
    });

    let savedLink;
    if (existing) {
      savedLink = await prisma.socialLinks.update({
        where: { SocialLinkID: existing.SocialLinkID },
        data: {
          Label: data.label,
          URL: data.url,
          IconName: data.iconName,
          DisplayOrder: data.displayOrder ?? existing.DisplayOrder,
          IsActive: data.isActive ?? existing.IsActive,
          UpdatedAt: new Date(),
          UpdatedBy: userId,
        },
      });
    } else {
      savedLink = await prisma.socialLinks.create({
        data: {
          Platform: data.platform.toUpperCase(),
          Label: data.label,
          URL: data.url,
          IconName: data.iconName,
          DisplayOrder: data.displayOrder ?? 0,
          IsActive: data.isActive ?? true,
          CreatedAt: new Date(),
          CreatedBy: userId,
        },
      });
    }

    return {
      ...savedLink,
      SocialLinkID: String(savedLink.SocialLinkID),
      CreatedBy: savedLink.CreatedBy ? String(savedLink.CreatedBy) : null,
      UpdatedBy: savedLink.UpdatedBy ? String(savedLink.UpdatedBy) : null,
    };
  },

  async deleteSocialLink(linkId: bigint) {
    const link = await prisma.socialLinks.findUnique({ where: { SocialLinkID: linkId } });
    if (!link) throw new NotFoundError('Social link not found');
    await prisma.socialLinks.delete({ where: { SocialLinkID: linkId } });
    return { message: 'Social link deleted' };
  },
};

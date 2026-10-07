import { contentPagesRepository } from './contentPages.repository.js';
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
    return contentPagesRepository.listPublishedPages();
  },

  // Public: Get a single published page by slug
  async getPublishedPageBySlug(slug: string) {
    const page = await contentPagesRepository.getPublishedPageBySlug(slug);
    if (!page) throw new NotFoundError(`Page with slug "${slug}" not found or not published`);
    return page;
  },

  // Admin: List all pages (includes drafts)
  async adminListAllPages() {
    return contentPagesRepository.adminListAllPages();
  },

  // Admin: Get full page by ID
  async adminGetPageById(pageId: bigint) {
    const page = await contentPagesRepository.findPageById(pageId);
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
      status?: string;
      metaTitle?: string;
      metaDescription?: string;
      isSystemPage?: boolean;
    },
    userId?: bigint
  ) {
    const existing = await contentPagesRepository.findPageBySlug(data.slug);
    if (existing) throw new ConflictError(`A page with slug "${data.slug}" already exists`);

    // Disallow duplicate system pages of the same type
    if (SYSTEM_PAGE_TYPES.includes(data.pageType)) {
      const existingSystemPage = await contentPagesRepository.findSystemPageByType(data.pageType);
      if (existingSystemPage) {
        throw new ConflictError(
          `A system page for "${data.pageType}" already exists (ID: ${existingSystemPage.PageID}). Edit the existing page instead.`
        );
      }
    }

    return contentPagesRepository.createPage({
      pageType: data.pageType,
      title: data.title,
      slug: data.slug,
      content: data.content,
      status: data.status || 'PUBLISHED',
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      isSystemPage: data.isSystemPage ?? SYSTEM_PAGE_TYPES.includes(data.pageType),
      createdBy: userId,
      createdAt: new Date(),
    });
  },

  // Admin: Update a CMS page
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
    userId?: bigint
  ) {
    const page = await contentPagesRepository.findPageById(pageId);
    if (!page) throw new NotFoundError('CMS page not found');

    if (data.slug && data.slug !== page.Slug) {
      const collision = await contentPagesRepository.findPageBySlug(data.slug);
      if (collision) throw new ConflictError(`Slug "${data.slug}" is already in use`);
    }

    return contentPagesRepository.updatePage(pageId, {
      ...(data.title && { Title: data.title }),
      ...(data.slug && { Slug: data.slug }),
      ...(data.content && { Content: data.content }),
      ...(data.status && { Status: data.status }),
      ...(data.metaTitle !== undefined && { MetaTitle: data.metaTitle }),
      ...(data.metaDescription !== undefined && { MetaDescription: data.metaDescription }),
      UpdatedAt: new Date(),
      UpdatedBy: userId,
    });
  },

  // Admin: Delete a page (only non-system pages can be deleted)
  async deletePage(pageId: bigint) {
    const page = await contentPagesRepository.findPageById(pageId);
    if (!page) throw new NotFoundError('CMS page not found');
    if (page.IsSystemPage) {
      throw new BadRequestError(
        'System pages (Privacy, Terms, About, etc.) cannot be deleted. You may unpublish or archive them instead.'
      );
    }
    await contentPagesRepository.deletePage(pageId);
    return { success: true, message: `Page "${page.Title}" deleted successfully` };
  },

  // =====================================================
  // FAQs
  // =====================================================

  // Public: Get all active FAQ sections with active questions
  async getPublicFAQs() {
    return contentPagesRepository.listPublicFaqs();
  },

  async listPublicFaqs() {
    return contentPagesRepository.listPublicFaqs();
  },

  // Admin: List all sections with all items (including inactive)
  async adminListFAQSections() {
    return contentPagesRepository.adminListFaqSections();
  },

  async adminListFaqSections() {
    return contentPagesRepository.adminListFaqSections();
  },

  // Admin: Create a new FAQ section
  async createFaqSection(
    data: { title: string; slug: string; displayOrder?: number; status?: string },
    userId?: bigint
  ) {
    const existing = await contentPagesRepository.findFaqSectionBySlug(data.slug);
    if (existing) throw new ConflictError(`FAQ Section with slug "${data.slug}" already exists`);

    return contentPagesRepository.createFaqSection({
      title: data.title,
      slug: data.slug,
      displayOrder: data.displayOrder ?? 0,
      status: data.status || 'ACTIVE',
      createdBy: userId,
      createdAt: new Date(),
    });
  },

  // Admin: Update FAQ Section
  async updateFaqSection(
    sectionId: bigint,
    data: { title?: string; slug?: string; displayOrder?: number; status?: string },
    userId?: bigint
  ) {
    const sec = await contentPagesRepository.findFaqSectionById(sectionId);
    if (!sec) throw new NotFoundError('FAQ Section not found');

    return contentPagesRepository.updateFaqSection(sectionId, {
      ...(data.title && { Title: data.title }),
      ...(data.slug && { Slug: data.slug }),
      ...(data.displayOrder !== undefined && { DisplayOrder: data.displayOrder }),
      ...(data.status && { Status: data.status }),
      UpdatedAt: new Date(),
      UpdatedBy: userId,
    });
  },

  // Admin: Delete FAQ Section (cascades to items)
  async deleteFaqSection(sectionId: bigint) {
    const sec = await contentPagesRepository.findFaqSectionById(sectionId);
    if (!sec) throw new NotFoundError('FAQ Section not found');
    await contentPagesRepository.deleteFaqSection(sectionId);
    return { success: true, message: 'FAQ Section and all its questions deleted' };
  },

  // Admin: Add a question to an FAQ section
  async createFaqItem(
    sectionId: bigint,
    data: { question: string; answer: string; displayOrder?: number; status?: string },
    userId?: bigint
  ) {
    const sec = await contentPagesRepository.findFaqSectionById(sectionId);
    if (!sec) throw new NotFoundError('FAQ Section not found');

    return contentPagesRepository.createFaqItem({
      sectionId,
      question: data.question,
      answer: data.answer,
      displayOrder: data.displayOrder ?? 0,
      status: data.status || 'ACTIVE',
      createdBy: userId,
      createdAt: new Date(),
    });
  },

  // Admin: Update a question
  async updateFaqItem(
    itemId: bigint,
    data: { question?: string; answer?: string; displayOrder?: number; status?: string },
    userId?: bigint
  ) {
    const item = await contentPagesRepository.findFaqItemById(itemId);
    if (!item) throw new NotFoundError('FAQ item not found');

    return contentPagesRepository.updateFaqItem(itemId, {
      ...(data.question && { Question: data.question }),
      ...(data.answer && { Answer: data.answer }),
      ...(data.displayOrder !== undefined && { DisplayOrder: data.displayOrder }),
      ...(data.status && { Status: data.status }),
      UpdatedAt: new Date(),
      UpdatedBy: userId,
    });
  },

  // Admin: Delete a question
  async deleteFaqItem(itemId: bigint) {
    const item = await contentPagesRepository.findFaqItemById(itemId);
    if (!item) throw new NotFoundError('FAQ item not found');
    await contentPagesRepository.deleteFaqItem(itemId);
    return { success: true, message: 'FAQ item deleted' };
  },

  async createFAQSection(data: any, userId?: bigint) {
    return this.createFaqSection(data, userId);
  },

  async updateFAQSection(sectionId: bigint, data: any, userId?: bigint) {
    return this.updateFaqSection(sectionId, data, userId);
  },

  async deleteFAQSection(sectionId: bigint) {
    return this.deleteFaqSection(sectionId);
  },

  async createFAQItem(sectionId: bigint, data: any, userId?: bigint) {
    return this.createFaqItem(sectionId, data, userId);
  },

  async updateFAQItem(itemId: bigint, data: any, userId?: bigint) {
    return this.updateFaqItem(itemId, data, userId);
  },

  async deleteFAQItem(itemId: bigint) {
    return this.deleteFaqItem(itemId);
  },

  // =====================================================
  // Contact & Company Info
  // =====================================================

  async getPublicContactInfo() {
    return contentPagesRepository.getActiveContactInfo();
  },

  async adminGetContactInfo() {
    const info = await contentPagesRepository.getActiveContactInfo();
    if (!info) return null;
    return {
      ...info,
      ContactInfoID: String(info.ContactInfoID),
      CreatedBy: info.CreatedAt ? String(info.ContactInfoID) : null,
      UpdatedBy: info.UpdatedAt ? String(info.ContactInfoID) : null,
    };
  },

  async submitContactInquiry(data: { name: string; email: string; subject?: string; message: string }) {
    const contact = await contentPagesRepository.getActiveContactInfo();
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
    const savedInfo = await contentPagesRepository.upsertContactInfo({
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
    }, userId);

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
    return contentPagesRepository.listPublicSocialLinks();
  },

  async listPublicSocialLinks() {
    return contentPagesRepository.listPublicSocialLinks();
  },

  async adminListSocialLinks() {
    const links = await contentPagesRepository.adminListSocialLinks();
    return links.map((l) => ({
      ...l,
      SocialLinkID: String(l.SocialLinkID),
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
    const savedLink = await contentPagesRepository.upsertSocialLink({
      platform: data.platform,
      label: data.label,
      url: data.url,
      iconName: data.iconName,
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
    }, userId);

    return {
      ...savedLink,
      SocialLinkID: String(savedLink.SocialLinkID),
    };
  },

  async deleteSocialLink(linkId: bigint) {
    const link = await contentPagesRepository.findSocialLinkById(linkId);
    if (!link) throw new NotFoundError('Social link not found');
    await contentPagesRepository.deleteSocialLink(linkId);
    return { success: true, message: `Social link "${link.Platform}" deleted` };
  },

  async testContactFormEmail(targetEmail?: string) {
    const destination = targetEmail || config.SMTP_EMAIL || 'support@hesaathi.com';
    return mailService.sendTestEmail(destination);
  },
};

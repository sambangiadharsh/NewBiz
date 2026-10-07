import { apiClient } from '../../lib/axios.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CMSPage {
  PageID: string;
  PageType: string;
  Title: string;
  Slug: string;
  Content: string;
  Status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  MetaTitle?: string | null;
  MetaDescription?: string | null;
  IsSystemPage?: boolean;
  CreatedAt: string;
  UpdatedAt?: string | null;
}

export interface FAQSection {
  FAQSectionID: string;
  Title: string;
  Slug: string;
  DisplayOrder: number;
  Status: string;
  FAQItems?: FAQItem[];
  CreatedAt: string;
  UpdatedAt?: string | null;
}

export interface FAQItem {
  FAQItemID: string;
  FAQSectionID: string;
  Question: string;
  Answer: string;
  DisplayOrder: number;
  Status: string;
  CreatedAt: string;
  UpdatedAt?: string | null;
}

export interface ContactInfo {
  ContactInfoID?: string;
  Email: string;
  Phone?: string | null;
  SupportPhone?: string | null;
  AddressLine1?: string | null;
  AddressLine2?: string | null;
  City?: string | null;
  State?: string | null;
  Country?: string | null;
  PostalCode?: string | null;
  BusinessHours?: string | null;
  MapEmbedURL?: string | null;
}

export interface SocialLink {
  SocialLinkID: string;
  Platform: string;
  Label: string;
  URL: string;
  IconName?: string | null;
  DisplayOrder: number;
  IsActive: boolean;
}

export type SocialPlatform =
  | 'INSTAGRAM'
  | 'TWITTER'
  | 'FACEBOOK'
  | 'LINKEDIN'
  | 'YOUTUBE'
  | 'PINTEREST'
  | 'TIKTOK'
  | 'WHATSAPP';

// ─── CMS Pages API ──────────────────────────────────────────────────────────

export const cmsApi = {
  listPages: () => apiClient.get<{ success: boolean; data: CMSPage[] }>('/content/admin/pages'),

  getPage: (id: string) =>
    apiClient.get<{ success: boolean; data: CMSPage }>(`/content/admin/pages/${id}`),

  createPage: (data: {
    pageType: string;
    title: string;
    slug: string;
    content: string;
    status: string;
    metaTitle?: string;
    metaDescription?: string;
    isSystemPage?: boolean;
  }) => apiClient.post<{ success: boolean; data: CMSPage }>('/content/admin/pages', data),

  updatePage: (id: string, data: Partial<CMSPage>) =>
    apiClient.put<{ success: boolean; data: CMSPage }>(`/content/admin/pages/${id}`, data),

  deletePage: (id: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/content/admin/pages/${id}`),

  // ─── FAQ Sections ─────────────────────────────────────────────────────────

  listFAQSections: () =>
    apiClient.get<{ success: boolean; data: FAQSection[] }>('/content/admin/faqs'),

  createFAQSection: (data: { title: string; slug: string; displayOrder?: number }) =>
    apiClient.post<{ success: boolean; data: FAQSection }>('/content/admin/faqs/sections', data),

  updateFAQSection: (
    sectionId: string,
    data: { title?: string; displayOrder?: number; status?: string }
  ) =>
    apiClient.put<{ success: boolean; data: FAQSection }>(
      `/content/admin/faqs/sections/${sectionId}`,
      data
    ),

  deleteFAQSection: (sectionId: string) =>
    apiClient.delete<{ success: boolean; message: string }>(
      `/content/admin/faqs/sections/${sectionId}`
    ),

  // ─── FAQ Items ────────────────────────────────────────────────────────────

  createFAQItem: (
    sectionId: string,
    data: { question: string; answer: string; displayOrder?: number }
  ) =>
    apiClient.post<{ success: boolean; data: FAQItem }>(
      `/content/admin/faqs/sections/${sectionId}/items`,
      data
    ),

  updateFAQItem: (
    itemId: string,
    data: { question?: string; answer?: string; displayOrder?: number; status?: string }
  ) =>
    apiClient.put<{ success: boolean; data: FAQItem }>(
      `/content/admin/faqs/items/${itemId}`,
      data
    ),

  deleteFAQItem: (itemId: string) =>
    apiClient.delete<{ success: boolean; message: string }>(
      `/content/admin/faqs/items/${itemId}`
    ),

  // ─── Contact Info ─────────────────────────────────────────────────────────

  getContactInfo: () =>
    apiClient.get<{ success: boolean; data: ContactInfo | null }>('/content/admin/contact'),

  upsertContactInfo: (data: ContactInfo) =>
    apiClient.put<{ success: boolean; data: ContactInfo }>('/content/admin/contact', data),

  // ─── Social Links ─────────────────────────────────────────────────────────

  listSocialLinks: () =>
    apiClient.get<{ success: boolean; data: SocialLink[] }>('/content/admin/social-links'),

  upsertSocialLink: (data: {
    platform: SocialPlatform;
    label: string;
    url: string;
    iconName?: string;
    displayOrder?: number;
    isActive?: boolean;
  }) =>
    apiClient.put<{ success: boolean; data: SocialLink }>('/content/admin/social-links', data),

  deleteSocialLink: (linkId: string) =>
    apiClient.delete<{ success: boolean; message: string }>(
      `/content/admin/social-links/${linkId}`
    ),
};

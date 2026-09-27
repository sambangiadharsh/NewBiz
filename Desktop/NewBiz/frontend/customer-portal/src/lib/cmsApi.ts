const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api/v1';

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data as T;
}

export interface CMSPage {
  PageID: string;
  PageType: string;
  Title: string;
  Slug: string;
  Content: string;
  MetaTitle?: string | null;
  MetaDescription?: string | null;
  UpdatedAt?: string | null;
}

export interface CMSPageSummary {
  PageID: string;
  PageType: string;
  Title: string;
  Slug: string;
  MetaTitle?: string | null;
  MetaDescription?: string | null;
  IsSystemPage?: boolean;
  UpdatedAt?: string | null;
}

export interface FAQItem {
  FAQItemID: string;
  Question: string;
  Answer: string;
  DisplayOrder: number;
}

export interface FAQSection {
  FAQSectionID: string;
  Title: string;
  Slug: string;
  DisplayOrder: number;
  FAQItems: FAQItem[];
}

export interface ContactInfo {
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
}

export const storeCmsApi = {
  getPublishedPages: (): Promise<CMSPageSummary[]> =>
    fetchJSON<CMSPageSummary[]>('/content/pages'),

  getPageBySlug: (slug: string): Promise<CMSPage> =>
    fetchJSON<CMSPage>(`/content/pages/${slug}`),

  getFAQs: (): Promise<FAQSection[]> =>
    fetchJSON<FAQSection[]>('/content/faqs'),

  getContactInfo: (): Promise<ContactInfo | null> =>
    fetchJSON<ContactInfo | null>('/content/contact'),

  getSocialLinks: (): Promise<SocialLink[]> =>
    fetchJSON<SocialLink[]>('/content/social-links'),

  submitContactInquiry: async (data: {
    name: string;
    email: string;
    subject?: string;
    message: string;
  }): Promise<{ referenceId: string; receivedAt: string; recipientEmail: string }> => {
    const res = await fetch(`${API_BASE}/content/contact/inquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? `HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  },
};

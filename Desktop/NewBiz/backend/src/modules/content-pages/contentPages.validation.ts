import { z } from 'zod';

export const createPageSchema = z.object({
  pageType: z.string().min(1).max(50),
  title: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes only'),
  content: z.string().min(1, 'Content is required'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(500).optional(),
  isSystemPage: z.boolean().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes only')
    .optional(),
  content: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  metaTitle: z.string().max(255).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
});

export const createFAQSectionSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes only'),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateFAQSectionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  displayOrder: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const createFAQItemSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateFAQItemSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).optional(),
  displayOrder: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const sanitizeMapEmbedUrl = (val: unknown): string | null | undefined => {
  if (val === null || val === undefined) return val as null | undefined;
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeMatch) {
    return iframeMatch[1];
  }
  return trimmed;
};

const optionalNullableString = (max: number) =>
  z.preprocess((val) => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed === '' ? null : trimmed;
    }
    return val;
  }, z.string().max(max).optional().nullable());

export const upsertContactInfoSchema = z
  .object({
    email: z.string().email().max(255).optional(),
    Email: z.string().email().max(255).optional(),
    phone: optionalNullableString(50),
    Phone: optionalNullableString(50),
    supportPhone: optionalNullableString(50),
    SupportPhone: optionalNullableString(50),
    addressLine1: optionalNullableString(255),
    AddressLine1: optionalNullableString(255),
    addressLine2: optionalNullableString(255),
    AddressLine2: optionalNullableString(255),
    city: optionalNullableString(100),
    City: optionalNullableString(100),
    state: optionalNullableString(100),
    State: optionalNullableString(100),
    country: optionalNullableString(100),
    Country: optionalNullableString(100),
    postalCode: optionalNullableString(20),
    PostalCode: optionalNullableString(20),
    businessHours: optionalNullableString(255),
    BusinessHours: optionalNullableString(255),
    mapEmbedURL: z.preprocess(sanitizeMapEmbedUrl, z.string().max(1000).optional().nullable()),
    MapEmbedURL: z.preprocess(sanitizeMapEmbedUrl, z.string().max(1000).optional().nullable()),
    ContactInfoID: z.any().optional(),
    contactInfoId: z.any().optional(),
  })
  .refine((data) => !!(data.email || data.Email), {
    message: 'Valid email address is required',
    path: ['email'],
  });


export const upsertSocialLinkSchema = z.object({
  platform: z.enum([
    'INSTAGRAM',
    'TWITTER',
    'FACEBOOK',
    'LINKEDIN',
    'YOUTUBE',
    'PINTEREST',
    'TIKTOK',
    'WHATSAPP',
  ]),
  label: z.string().min(1).max(100),
  url: z.string().url().max(1000),
  iconName: z.string().max(50).optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

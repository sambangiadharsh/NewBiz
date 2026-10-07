import { z } from 'zod';

export const masterProfileSchema = z.object({
  businessName: z
    .string({ required_error: 'Legal Business Name is required' })
    .min(2, 'Legal Business Name must be at least 2 characters')
    .max(255),
  sellerName: z
    .string({ required_error: 'Brand / Trade Name is required' })
    .min(2, 'Brand Name must be at least 2 characters')
    .max(200),
  email: z.string().email('Valid contact email is required').max(255),
  phoneNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number (e.g. 9876543210)'),
  primaryCategoryId: z.coerce.number().positive('Please select a valid primary category'),
  instagramUrl: z.string().optional().or(z.literal('')),
  facebookUrl: z.string().optional().or(z.literal('')),
  youtubeUrl: z.string().optional().or(z.literal('')),
  linkedinUrl: z.string().optional().or(z.literal('')),
  websiteUrl: z.string().optional().or(z.literal('')),
  consentGranted: z.boolean().optional(),
});

export const documentUploadSchema = z.object({
  documentTypeCode: z.string().min(1, 'Document type code is required').max(50),
  certificateNumber: z.string().max(100).optional().or(z.literal('')),
});

export type MasterProfileInput = z.infer<typeof masterProfileSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;

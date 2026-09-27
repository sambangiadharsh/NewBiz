import { z } from 'zod';

export const createCategorySchema = z.object({
  categoryName: z.string().min(2, 'Category name must be at least 2 characters').max(150),
  categoryCode: z
    .string()
    .min(2, 'Category code must be at least 2 characters')
    .max(20)
    .regex(/^[A-Z0-9_-]+$/i, 'Category code must be alphanumeric')
    .transform((v) => v.toUpperCase().trim()),
  parentCategoryId: z.number().int().positive().nullable().optional(),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateCategorySchema = createCategorySchema.partial();

export const linkCategoryDocumentSchema = z.object({
  documentTypeId: z.coerce.number().int().positive('Valid document type is required'),
  isMandatory: z.boolean().default(true),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const createDocumentTypeSchema = z.object({
  code: z
    .string()
    .min(2, 'Document code must be at least 2 characters')
    .max(50)
    .transform((v) => v.toUpperCase().trim()),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(150),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const linkCategoryAttributeSchema = z.object({
  attributeId: z.coerce.string().min(1, 'Attribute ID is required'),
  isRequired: z.boolean().default(false),
  isVariantDefining: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(1).default(1),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type LinkCategoryDocumentInput = z.infer<typeof linkCategoryDocumentSchema>;
export type CreateDocumentTypeInput = z.infer<typeof createDocumentTypeSchema>;
export type LinkCategoryAttributeInput = z.infer<typeof linkCategoryAttributeSchema>;

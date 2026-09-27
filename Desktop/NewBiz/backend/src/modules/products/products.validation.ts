import { z } from 'zod';

export const searchCatalogSchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const proposeProductSchema = z.object({
  brandId: z.union([z.string(), z.number()]).transform(String),
  leafCategoryId: z.union([z.string(), z.number()]).transform(String),
  productName: z.string().trim().min(3, 'Product name must be at least 3 characters').max(255),
  description: z.string().trim().optional().default(''),
  specifications: z
    .array(
      z.object({
        attributeId: z.union([z.string(), z.number()]).transform(String),
        attributeValueId: z.union([z.string(), z.number()]).transform(String).optional(),
        attributeValue: z.string().trim(),
      })
    )
    .default([]),
  variants: z
    .array(
      z.object({
        attributeValues: z
          .array(
            z.object({
              attributeId: z.union([z.string(), z.number()]).transform(String),
              attributeValueId: z.union([z.string(), z.number()]).transform(String),
            })
          )
          .default([]),
        gtin: z.string().trim().max(50).optional(),
        productModelCode: z.string().trim().max(100).optional(),
        hsnCode: z.string().trim().max(20).optional(),
        gstRate: z.coerce.number().min(0).max(100).optional(),
        length: z.coerce.number().positive().optional(),
        width: z.coerce.number().positive().optional(),
        height: z.coerce.number().positive().optional(),
        weight: z.coerce.number().positive().optional(),
        capacity: z.coerce.number().positive().optional(),
        uoms: z
          .array(
            z.object({
              uomId: z.union([z.string(), z.number()]).transform(String),
              quantity: z.coerce.number().positive().default(1),
            })
          )
          .default([]),
        assets: z
          .array(
            z.object({
              assetType: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']).default('IMAGE'),
              assetUrl: z.string().trim().min(1, 'Asset URL is required').refine(
                (val) => val.startsWith('/') || /^https?:\/\//i.test(val),
                { message: 'Asset URL must be a valid URL or an uploaded file path' }
              ),
              isPrimary: z.boolean().default(false),
              altText: z.string().trim().optional(),
              displayOrder: z.coerce.number().int().default(0),
            })
          )
          .default([]),
      })
    )
    .min(1, 'At least one variant must be defined'),
});

export const addSellerProductSchema = z
  .object({
    productVariantId: z.union([z.string(), z.number()]).transform(String),
    sellerSku: z.string().trim().min(2, 'Seller SKU must be at least 2 characters').max(100),
    mrp: z.coerce.number().positive('MRP must be greater than 0'),
    sellingPrice: z.coerce.number().positive('Selling Price must be greater than 0'),
    purchasePrice: z.coerce.number().positive('Purchase Price must be greater than 0'),
  })
  .refine((data) => data.sellingPrice <= data.mrp, {
    message: 'Selling Price cannot be higher than MRP',
    path: ['sellingPrice'],
  });

export const adminQCReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REWORK_REQUIRED', 'REJECT']),
  remarks: z.string().trim().min(3, 'Review remarks are required'),
});

export type SearchCatalogQuery = z.infer<typeof searchCatalogSchema>;
export type ProposeProductInput = z.infer<typeof proposeProductSchema>;
export type AddSellerProductInput = z.infer<typeof addSellerProductSchema>;
export type AdminQCReviewInput = z.infer<typeof adminQCReviewSchema>;

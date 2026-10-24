import { z } from 'zod';

export const searchCatalogSchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const variantSchema = z.object({
  attributeValues: z
    .array(
      z.object({
        attributeId: z.union([z.string(), z.number()]).transform(String),
        attributeValueId: z.union([z.string(), z.number()]).transform(String).optional().nullable(),
        attributeValue: z.string().optional().nullable(),
        valueName: z.string().optional().nullable(),
      })
    )
    .default([]),
  gtin: z.string().trim().max(50).optional(),
  variantModelCode: z.string().trim().max(100).optional(), // manufacturer variant part number (e.g. "AH8050-002")
  length: z.coerce.number().positive().optional(),
  width: z.coerce.number().positive().optional(),
  height: z.coerce.number().positive().optional(),
  weight: z.coerce.number().positive().optional(),
  netWeight: z.coerce.number().positive().optional(),
  grossWeight: z.coerce.number().positive().optional(),
  shippingWeight: z.coerce.number().positive().optional(),
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
});

export const proposeProductSchema = z.object({
  brandId: z.union([z.string(), z.number()]).transform(String),
  leafCategoryId: z.union([z.string(), z.number()]).transform(String),
  productName: z.string().trim().min(3, 'Product name must be at least 3 characters').max(255),
  description: z.string().trim().optional().default(''),
  highlights: z.array(z.string().trim()).max(10).optional().default([]),
  // Product-level fields (India GST + base model — shared by all variants)
  baseModelCode: z.string().trim().max(100).optional(),
  hsnCode: z.string().trim().max(20).optional(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  countryOfOrigin: z.string().trim().max(100).optional().default('India'),
  specifications: z
    .array(
      z.object({
        attributeId: z.union([z.string(), z.number()]).transform(String),
        attributeValueId: z.union([z.string(), z.number()]).transform(String).optional(),
        attributeValue: z.string().trim(),
      })
    )
    .default([]),
  variants: z.array(variantSchema).min(1, 'At least one variant must be defined'),
});

export const addSellerProductSchema = z
  .object({
    productVariantId: z.union([z.string(), z.number()]).transform(String),
    sellerSku: z.string().trim().min(2, 'Seller SKU must be at least 2 characters').max(100),
    mrp: z.coerce.number().positive('MRP must be greater than 0'),
    sellingPrice: z.coerce.number().positive('Selling Price must be greater than 0'),
    purchasePrice: z.coerce.number().positive('Purchase Price must be greater than 0'),
    packerName: z.string().trim().max(255).nullable().optional(),
    importerName: z.string().trim().max(255).nullable().optional(),
  })
  .refine((data) => data.sellingPrice <= data.mrp, {
    message: 'Selling Price cannot be higher than MRP',
    path: ['sellingPrice'],
  });

export const warehouseAllocationItemSchema = z.object({
  warehouseId: z.union([z.string(), z.number()]).transform(String),
  initialQuantity: z.coerce.number().int().min(0, 'Initial quantity must be 0 or greater').default(0),
  poNumber: z.string().trim().max(100).optional(),
  poAmount: z.coerce.number().min(0).optional(),
  supplierInvoiceNumber: z.string().trim().max(100).optional(),
  invoiceAmount: z.coerce.number().min(0).optional(),
});

export const onboardSellerProductSchema = z
  .object({
    productVariantId: z.union([z.string(), z.number()]).transform(String),
    sellerSku: z.string().trim().min(2, 'Seller SKU must be at least 2 characters').max(100),
    mrp: z.coerce.number().positive('MRP must be greater than 0'),
    sellingPrice: z.coerce.number().positive('Selling Price must be greater than 0'),
    purchasePrice: z.coerce.number().positive('Purchase Price must be greater than 0'),
    packerName: z.string().trim().max(255).nullable().optional(),
    importerName: z.string().trim().max(255).nullable().optional(),
    allocations: z.array(warehouseAllocationItemSchema).min(1, 'Please select at least one warehouse for fulfillment allocation'),
  })
  .refine((data) => data.sellingPrice <= data.mrp, {
    message: 'Selling Price cannot be higher than MRP',
    path: ['sellingPrice'],
  })
  .refine((data) => data.purchasePrice <= data.sellingPrice, {
    message: 'Purchase Price cannot exceed Selling Price (negative margin)',
    path: ['purchasePrice'],
  });

export const adminQCReviewSchema = z
  .object({
    action: z.enum(['APPROVE', 'REWORK_REQUIRED', 'REWORK', 'REJECT']),
    remarks: z.string().trim().optional().nullable(),
    reason: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.action === 'REWORK_REQUIRED' || data.action === 'REWORK' || data.action === 'REJECT') {
        const text = (data.remarks || data.reason || '').trim();
        return text.length >= 3;
      }
      return true;
    },
    {
      message: 'Detailed reason / remarks are required when requesting rework or rejecting',
      path: ['remarks'],
    }
  );

export const adminCreateProductSchema = proposeProductSchema.extend({
  initialStatus: z.enum(['PENDING_QC', 'DRAFT', 'ACTIVE']).default('PENDING_QC'),
});

export const adminAddVariantSchema = variantSchema.extend({
  initialStatus: z.enum(['PENDING_QC', 'DRAFT', 'ACTIVE']).default('PENDING_QC'),
});

export const adminUpdateProductMasterSchema = z.object({
  productName: z.string().trim().min(2, 'Product Name must be at least 2 characters').max(255).optional(),
  description: z.string().trim().nullable().optional(),
  highlights: z.array(z.string().trim().min(1)).optional(),
  baseModelCode: z.string().trim().max(100).nullable().optional(),
  hsnCode: z.string().trim().max(20).nullable().optional(),
  gstRate: z.coerce.number().min(0).max(28).nullable().optional(),
  countryOfOrigin: z.string().trim().max(100).nullable().optional(),
  brandId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'PENDING_QC', 'APPROVED', 'REJECTED']).optional(),
  specifications: z
    .array(
      z.object({
        attributeId: z.union([z.string(), z.number()]).transform(String),
        attributeValueId: z.union([z.string(), z.number()]).transform(String).optional().nullable(),
        attributeValue: z.string(),
      })
    )
    .optional(),
});

export const adminUpdateProductVariantSchema = z.object({
  gtin: z.string().trim().max(100).nullable().optional(),
  variantModelCode: z.string().trim().max(100).nullable().optional(),
  length: z.coerce.number().positive().nullable().optional(),
  width: z.coerce.number().positive().nullable().optional(),
  height: z.coerce.number().positive().nullable().optional(),
  weight: z.coerce.number().positive().nullable().optional(),
  netWeight: z.coerce.number().positive().nullable().optional(),
  grossWeight: z.coerce.number().positive().nullable().optional(),
  shippingWeight: z.coerce.number().positive().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'PENDING_QC', 'APPROVED', 'REJECTED']).optional(),
  assets: z
    .array(
      z.object({
        assetUrl: z.string().trim().min(1, 'Asset URL is required'),
        isPrimary: z.boolean().default(false),
        displayOrder: z.number().int().optional().default(1),
        altText: z.string().trim().nullable().optional(),
      })
    )
    .optional(),
});

export const batchOnboardSellerProductsSchema = z.object({
  items: z.array(onboardSellerProductSchema).min(1, 'Please select at least one variant to onboard'),
});

export const updateSellerProductPricingSchema = z.object({
  sellingPrice: z.coerce.number().positive().optional(),
  mrp: z.coerce.number().positive().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  packerName: z.string().trim().max(255).nullable().optional(),
  importerName: z.string().trim().max(255).nullable().optional(),
});

export type SearchCatalogQuery = z.infer<typeof searchCatalogSchema>;
export type ProposeProductInput = z.infer<typeof proposeProductSchema>;
export type AddSellerProductInput = z.infer<typeof addSellerProductSchema>;
export type WarehouseAllocationItem = z.infer<typeof warehouseAllocationItemSchema>;
export type OnboardSellerProductInput = z.infer<typeof onboardSellerProductSchema>;
export type BatchOnboardSellerProductsInput = z.infer<typeof batchOnboardSellerProductsSchema>;
export type UpdateSellerProductPricingInput = z.infer<typeof updateSellerProductPricingSchema>;
export type AdminQCReviewInput = z.infer<typeof adminQCReviewSchema>;
export type AdminCreateProductInput = z.infer<typeof adminCreateProductSchema>;
export type AdminAddVariantInput = z.infer<typeof adminAddVariantSchema>;
export type AdminUpdateProductMasterInput = z.infer<typeof adminUpdateProductMasterSchema>;
export type AdminUpdateProductVariantInput = z.infer<typeof adminUpdateProductVariantSchema>;



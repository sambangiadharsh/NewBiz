import { z } from 'zod';

export const createWarehouseSchema = z.object({
  warehouseName: z.string().min(2, 'Warehouse name must be at least 2 characters').max(200),
  warehouseCode: z
    .string()
    .min(2, 'Warehouse code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Warehouse code must contain only uppercase letters, numbers, hyphens, or underscores')
    .optional(),
  warehouseType: z.enum(['OWN', '3PL', 'THIRD_PARTY'], {
    errorMap: () => ({ message: 'Warehouse type must be OWN, 3PL, or THIRD_PARTY' }),
  }),
  contactPersonName: z.string().max(150).optional().nullable(),
  contactEmail: z.string().email('Invalid contact email').optional().nullable(),
  contactPhoneNumber: z.string().max(20).optional().nullable(),
  addressLine1: z.string().min(3, 'Address line 1 is required').max(255),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(100),
  postalCode: z.string().min(3, 'Postal code is required').max(20),
  country: z.string().min(2, 'Country is required').max(100).default('India'),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial().extend({
  status: z.enum(['VERIFIED', 'ACTIVE', 'INACTIVE', 'PENDING_APPROVAL', 'REWORK_REQUIRED', 'REJECTED']).optional(),
});

export const assignWarehouseUserSchema = z.object({
  email: z.string().email('Valid email address is required'),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phoneNumber: z.string().max(20).optional().nullable(),
  temporaryPassword: z.string().min(6, 'Temporary password must be at least 6 characters').optional(),
});

export const reworkWarehouseSchema = z.object({
  comments: z.string().min(3, 'Feedback comments are required').max(500),
});

export const resubmitWarehouseSchema = z.object({
  remarks: z.string().max(500).optional(),
});

export const createSellerWarehouseSchema = z.object({
  warehouseName: z.string().min(2, 'Warehouse name must be at least 2 characters').max(200),
  warehouseCode: z
    .string()
    .min(2, 'Warehouse code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Warehouse code must contain only uppercase letters, numbers, hyphens, or underscores')
    .optional(),
  warehouseType: z.enum(['OWN', '3PL'], {
    errorMap: () => ({ message: 'Warehouse type must be OWN or 3PL' }),
  }),
  contactPersonName: z.string().max(150).optional().nullable(),
  contactEmail: z.string().email('Invalid contact email').optional().nullable(),
  contactPhoneNumber: z.string().max(20).optional().nullable(),
  addressLine1: z.string().min(3, 'Address line 1 is required').max(255),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(100),
  postalCode: z.string().min(3, 'Postal code is required').max(20),
  country: z.string().min(2, 'Country is required').max(100).default('India'),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  isPrimary: z.boolean().optional(),
});

export const reviewWarehouseSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REWORK_REQUIRED'], {
    errorMap: () => ({ message: 'Decision must be APPROVE, REJECT, or REWORK_REQUIRED' }),
  }),
  rejectionReason: z.string().max(500).optional(),
  comments: z.string().max(500).optional(),
});

export const connect3PLWarehouseSchema = z.object({
  warehouseId: z.coerce.number().int().positive('Valid warehouse ID is required'),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().max(500).optional(),
});

export const linkSellerTo3PLSchema = z.object({
  sellerId: z.coerce.number().int().positive('Valid seller ID is required'),
  warehouseId: z.coerce.number().int().positive('Valid warehouse ID is required'),
  isPrimary: z.boolean().optional().default(false),
});

export const reviewSellerLinkageSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT'], {
    errorMap: () => ({ message: 'Decision must be either APPROVE or REJECT' }),
  }),
  comments: z.string().max(500).optional(),
});

export const uploadWarehouseDocumentSchema = z.object({
  documentTypeCode: z.string().min(1, 'Document type code is required'),
  documentNumber: z.string().max(100).optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type CreateSellerWarehouseInput = z.infer<typeof createSellerWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type AssignWarehouseUserInput = z.infer<typeof assignWarehouseUserSchema>;
export type ReviewWarehouseInput = z.infer<typeof reviewWarehouseSchema>;
export type Connect3PLWarehouseInput = z.infer<typeof connect3PLWarehouseSchema>;
export type LinkSellerTo3PLInput = z.infer<typeof linkSellerTo3PLSchema>;
export type ReviewSellerLinkageInput = z.infer<typeof reviewSellerLinkageSchema>;
export type UploadWarehouseDocumentInput = z.infer<typeof uploadWarehouseDocumentSchema>;


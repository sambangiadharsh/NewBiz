import { z } from 'zod';

export const createAttributeSchema = z.object({
  attributeName: z
    .string({ required_error: 'Attribute name is required' })
    .trim()
    .min(2, 'Attribute name must be at least 2 characters')
    .max(100, 'Attribute name cannot exceed 100 characters'),
  dataType: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'OPTIONS'], {
    errorMap: () => ({ message: 'Data type must be STRING, NUMBER, BOOLEAN, or OPTIONS' }),
  }),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  values: z.array(z.object({ valueName: z.string(), valueCode: z.string().optional() })).optional(),
});

export const updateAttributeSchema = z.object({
  attributeName: z
    .string()
    .trim()
    .min(2, 'Attribute name must be at least 2 characters')
    .max(100, 'Attribute name cannot exceed 100 characters')
    .optional(),
  dataType: z
    .enum(['STRING', 'NUMBER', 'BOOLEAN', 'OPTIONS'], {
      errorMap: () => ({ message: 'Data type must be STRING, NUMBER, BOOLEAN, or OPTIONS' }),
    })
    .optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const createAttributeValueSchema = z.object({
  valueName: z
    .string({ required_error: 'Value name is required' })
    .trim()
    .min(1, 'Value name cannot be empty')
    .max(150, 'Value name cannot exceed 150 characters'),
  valueCode: z
    .string({ required_error: 'Value code is required' })
    .trim()
    .min(1, 'Value code cannot be empty')
    .max(50, 'Value code cannot exceed 50 characters')
    .transform((val) => val.toUpperCase()),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateAttributeValueSchema = z.object({
  valueName: z
    .string()
    .trim()
    .min(1, 'Value name cannot be empty')
    .max(150, 'Value name cannot exceed 150 characters')
    .optional(),
  valueCode: z
    .string()
    .trim()
    .min(1, 'Value code cannot be empty')
    .max(50, 'Value code cannot exceed 50 characters')
    .transform((val) => val.toUpperCase())
    .optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const createUOMSchema = z.object({
  uomCode: z
    .string({ required_error: 'UOM Code is required' })
    .trim()
    .min(1, 'UOM Code cannot be empty')
    .max(20, 'UOM Code cannot exceed 20 characters')
    .transform((val) => val.toUpperCase()),
  uomName: z
    .string({ required_error: 'UOM Name is required' })
    .trim()
    .min(1, 'UOM Name cannot be empty')
    .max(50, 'UOM Name cannot exceed 50 characters'),
  uomType: z.enum(['WEIGHT', 'VOLUME', 'LENGTH', 'COUNT', 'AREA', 'DIMENSION'], {
    errorMap: () => ({ message: 'UOM Type must be WEIGHT, VOLUME, LENGTH, COUNT, AREA, or DIMENSION' }),
  }),
  decimalPrecision: z.coerce
    .number()
    .int('Decimal precision must be an integer')
    .min(0, 'Decimal precision cannot be negative')
    .max(5, 'Decimal precision cannot exceed 5')
    .default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateUOMSchema = z.object({
  uomCode: z
    .string()
    .trim()
    .min(1, 'UOM Code cannot be empty')
    .max(20, 'UOM Code cannot exceed 20 characters')
    .transform((val) => val.toUpperCase())
    .optional(),
  uomName: z
    .string()
    .trim()
    .min(1, 'UOM Name cannot be empty')
    .max(50, 'UOM Name cannot exceed 50 characters')
    .optional(),
  uomType: z
    .enum(['WEIGHT', 'VOLUME', 'LENGTH', 'COUNT', 'AREA', 'DIMENSION'], {
      errorMap: () => ({ message: 'UOM Type must be WEIGHT, VOLUME, LENGTH, COUNT, AREA, or DIMENSION' }),
    })
    .optional(),
  decimalPrecision: z.coerce
    .number()
    .int('Decimal precision must be an integer')
    .min(0, 'Decimal precision cannot be negative')
    .max(5, 'Decimal precision cannot exceed 5')
    .optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>;
export type CreateAttributeValueInput = z.infer<typeof createAttributeValueSchema>;
export type UpdateAttributeValueInput = z.infer<typeof updateAttributeValueSchema>;
export type CreateUOMInput = z.infer<typeof createUOMSchema>;
export type UpdateUOMInput = z.infer<typeof updateUOMSchema>;

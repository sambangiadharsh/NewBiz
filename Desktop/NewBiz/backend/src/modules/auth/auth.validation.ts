import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});

export const sellerRegisterSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().trim().min(1, 'Last name must be at least 1 character').max(50),
  email: z.string().email('Invalid email address format').trim().toLowerCase().max(255),
  phoneNumber: z.string().trim().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number (e.g. 9876543210)'),
  password: z.string().min(6, 'Password must be at least 6 characters long').max(100),
  sellerName: z.string().trim().optional(),
  businessName: z.string().trim().optional(),
  primaryCategoryId: z.union([z.string(), z.number()]).optional().transform((val) => (val ? Number(val) : undefined)),
});

export const customerRegisterSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().trim().min(1, 'Last name must be at least 1 character').max(50),
  email: z.string().email('Invalid email address format').trim().toLowerCase().max(255),
  password: z.string().min(6, 'Password must be at least 6 characters long').max(100),
  phoneNumber: z.string().trim().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address format').trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address format').trim().toLowerCase(),
  otp: z.string().length(6, 'Verification code must be 6 digits'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SellerRegisterInput = z.infer<typeof sellerRegisterSchema>;
export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

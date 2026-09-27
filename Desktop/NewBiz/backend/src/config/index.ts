import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.string().transform((val) => parseInt(val, 10)).default('10'),
  SMTP_HOST: z.string().default('mail.hesaathi.com'),
  SMTP_PORT: z.string().transform((val) => parseInt(val, 10)).default('587'),
  SMTP_EMAIL: z.string().default('support@hesaathi.com'),
  SMTP_PASSWORD: z.string().default(''),
  FROM_EMAIL: z.string().default('support@hesaathi.com'),
  FROM_NAME: z.string().default('HESA Commerce'),
});

const parseConfig = () => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Environment configuration validation failed');
  }
  return {
    ...parsed.data,
    corsOriginsList: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  };
};

export const config = parseConfig();
export type Config = typeof config;

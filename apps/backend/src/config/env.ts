import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import dotenv from 'dotenv';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const monorepoRoot = path.resolve(backendRoot, '../..');

dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(monorepoRoot, '.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  MONGODB_URI: z.string().min(1),
  /** Set true only when MongoDB is a replica set or mongos (required for multi-doc transactions). */
  MONGODB_USE_TRANSACTIONS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default(
    'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5175',
  ),
  STORAGE_PROVIDER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
  PAYMENT_PROVIDER: z.enum(['cod', 'razorpay', 'stripe']).default('cod'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  /** Per IP; keep high in development — mobile polls cart/home often. */
  RATE_LIMIT_MAX: z.coerce.number().default(2_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  OTP_PROVIDER: z.enum(['msg91', 'mock']).default('mock'),
  TEST_OTP: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(4),
  OTP_EXPIRY_SECONDS: z.coerce.number().int().min(60).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(10).default(30),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production' && data.OTP_PROVIDER === 'mock') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'OTP_PROVIDER=mock is not allowed when NODE_ENV=production',
      path: ['OTP_PROVIDER'],
    });
  }
  if (data.OTP_PROVIDER === 'msg91' && data.NODE_ENV === 'production') {
    if (!data.MSG91_AUTH_KEY?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MSG91_AUTH_KEY is required when OTP_PROVIDER=msg91 in production',
        path: ['MSG91_AUTH_KEY'],
      });
    }
    if (!data.MSG91_TEMPLATE_ID?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MSG91_TEMPLATE_ID is required when OTP_PROVIDER=msg91 in production',
        path: ['MSG91_TEMPLATE_ID'],
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

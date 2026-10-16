import { z } from 'zod';

const boolFromString = z.enum(['true', 'false']).transform((value) => value === 'true');
const emptyStringAsUndefined = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const apiEnvShape = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  CORS_ALLOWED_ORIGINS: z.string().min(1).default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  SESSION_DURATION_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .default(24 * 7),
  SESSION_COOKIE_NAME: z.string().min(1).default('monthloom_session'),
  SESSION_COOKIE_SECURE: boolFromString.default('false'),
  JSON_BODY_LIMIT: z.string().min(1).default('1mb'),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  UPLOAD_MAX_SIZE_BYTES: z.coerce
    .number()
    .int()
    .min(1)
    .default(5 * 1024 * 1024),
  UPLOAD_ALLOWED_MIME_TYPES: z.string().min(1).default('image/jpeg,image/png,image/webp'),
  EMAIL_TRANSPORT: z.enum(['log', 'resend']).default('log'),
  EMAIL_FROM_NAME: z.string().min(1).default('Monthloom'),
  EMAIL_FROM_ADDRESS: z.string().email().default('no-reply@monthloom.local'),
  EMAIL_REPLY_TO: emptyStringAsUndefined(z.string().email()),
  RESEND_API_KEY: emptyStringAsUndefined(z.string().startsWith('re_')),
  RESEND_ADMIN_KEY: emptyStringAsUndefined(z.string().startsWith('re_')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(10),
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(30),
  PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(5),
  EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(60),
  EMAIL_VERIFICATION_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(10),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
} satisfies z.ZodRawShape;

export const apiEnvSchema = z.object(apiEnvShape).superRefine((env, context) => {
  if (env.EMAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RESEND_API_KEY'],
      message: 'RESEND_API_KEY is required when EMAIL_TRANSPORT=resend',
    });
  }
});

export const apiEnvKeys = Object.keys(apiEnvShape);

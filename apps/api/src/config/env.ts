import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

import { apiEnvSchema } from './env.schema.js';

// Local dev scripts run with cwd set to apps/api, but the shared .env lives at the repo root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Tests supply an isolated environment and must never load local credentials.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
}

function loadEnv() {
  const parsed = apiEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    // Configuration errors must fail startup immediately and loudly, never silently.
    console.error('Invalid environment configuration:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration. See details above.');
  }

  return parsed.data;
}

const env = loadEnv();

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',

  server: {
    port: env.API_PORT,
  },

  web: {
    publicUrl: env.WEB_PUBLIC_URL,
  },

  cors: {
    allowedOrigins: env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
  },

  jsonBodyLimit: env.JSON_BODY_LIMIT,

  database: {
    url: env.DATABASE_URL,
  },

  session: {
    secret: env.SESSION_SECRET,
    durationHours: env.SESSION_DURATION_HOURS,
    cookieName: env.SESSION_COOKIE_NAME,
    cookieSecure: env.SESSION_COOKIE_SECURE,
  },

  upload: {
    directory: env.UPLOAD_DIR,
    maxSizeBytes: env.UPLOAD_MAX_SIZE_BYTES,
    allowedMimeTypes: env.UPLOAD_ALLOWED_MIME_TYPES.split(',').map((type) => type.trim()),
  },

  email: {
    transport: env.EMAIL_TRANSPORT,
    from: {
      name: env.EMAIL_FROM_NAME,
      address: env.EMAIL_FROM_ADDRESS,
    },
    replyTo: env.EMAIL_REPLY_TO,
    resendApiKey: env.RESEND_API_KEY,
    resendAdminKey: env.RESEND_ADMIN_KEY,
  },

  logging: {
    level: env.LOG_LEVEL,
  },

  rateLimit: {
    general: {
      windowMinutes: env.RATE_LIMIT_WINDOW_MINUTES,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    },
    authentication: {
      windowMinutes: env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
      maxRequests: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    },
    passwordReset: {
      windowMinutes: env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES,
      maxRequests: env.PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS,
    },
    emailVerification: {
      windowMinutes: env.EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_MINUTES,
      maxRequests: env.EMAIL_VERIFICATION_RATE_LIMIT_MAX_REQUESTS,
    },
  },

  trustedProxyHops: env.TRUSTED_PROXY_HOPS,
} as const;

export type AppConfig = typeof config;

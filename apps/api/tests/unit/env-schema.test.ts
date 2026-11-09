import { describe, expect, it } from 'vitest';

import { apiEnvSchema } from '../../src/config/env.schema.js';

const validProductionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://monthloom:secret@postgres:5432/monthloom',
  SESSION_SECRET: 'a-production-secret-with-enough-entropy',
  SESSION_COOKIE_SECURE: 'true',
};

describe('API environment schema', () => {
  it('requires a Resend key when Resend delivery is enabled', () => {
    const result = apiEnvSchema.safeParse({
      ...validProductionEnv,
      EMAIL_TRANSPORT: 'resend',
    });

    expect(result.success).toBe(false);
  });

  it('accepts production log delivery without a provider secret', () => {
    expect(apiEnvSchema.safeParse(validProductionEnv).success).toBe(true);
  });

  it('defaults the log directory', () => {
    const result = apiEnvSchema.parse(validProductionEnv);

    expect(result.LOG_DIRECTORY).toBe('logs');
  });

  it('accepts a custom log directory', () => {
    const result = apiEnvSchema.parse({
      ...validProductionEnv,
      LOG_DIRECTORY: '/var/log/monthloom',
    });

    expect(result.LOG_DIRECTORY).toBe('/var/log/monthloom');
  });

  it('rejects an empty log directory', () => {
    const result = apiEnvSchema.safeParse({
      ...validProductionEnv,
      LOG_DIRECTORY: '',
    });

    expect(result.success).toBe(false);
  });

  it('requires complete administrator bootstrap credentials', () => {
    expect(
      apiEnvSchema.safeParse({ ...validProductionEnv, ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com' })
        .success,
    ).toBe(false);
    expect(
      apiEnvSchema.safeParse({
        ...validProductionEnv,
        ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com',
        ADMIN_BOOTSTRAP_PASSWORD: 'Bootstrap-password-123!',
      }).success,
    ).toBe(true);
  });
});

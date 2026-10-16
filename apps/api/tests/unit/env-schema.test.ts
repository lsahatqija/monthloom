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
});

import { describe, expect, it } from 'vitest';

import { registerRequestSchema, resetPasswordRequestSchema } from '../src/index.js';

describe('auth contracts', () => {
  const registration = {
    email: 'person@example.com',
    password: 'password123',
    displayName: 'Person',
    profileImage: 'diamond-kilim',
    desiredColor: 'indigo',
  };
  it('strips injected privilege fields from registration', () => {
    expect(
      registerRequestSchema.parse({ ...registration, role: 'admin', emailVerified: true }),
    ).toEqual(registration);
  });
  it.each([{ email: 'invalid' }, { password: 'short' }, { profileImage: 'unknown' }])(
    'rejects invalid registration %j',
    (change) => {
      expect(registerRequestSchema.safeParse({ ...registration, ...change }).success).toBe(false);
    },
  );
  it('reports password mismatch on the confirmation field', () => {
    const result = resetPasswordRequestSchema.safeParse({
      token: 'a'.repeat(43),
      newPassword: 'password123',
      confirmNewPassword: 'different123',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.flatten().fieldErrors.confirmNewPassword).toEqual([
        'Passwords do not match',
      ]);
  });
});

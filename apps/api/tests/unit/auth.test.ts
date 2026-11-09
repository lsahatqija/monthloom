import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { Logger } from '../../src/infrastructure/logging/logger.js';
import { hashPassword } from '../../src/infrastructure/security/password.js';
import { hashSessionToken } from '../../src/infrastructure/security/tokens.js';
import type { SessionRepository } from '../../src/modules/auth/auth.repository.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import type { AutomatedEmailService } from '../../src/modules/email/automated-email.service.js';
import type { UserRepository } from '../../src/modules/users/user.repository.js';
import { user } from '../fixtures.js';

describe('authentication service', () => {
  const users = mock<UserRepository>();
  const sessions = mock<SessionRepository>();
  const email = mock<AutomatedEmailService>();
  const logger = mock<Logger>();
  const service = new AuthService(users, sessions, email, logger);

  beforeEach(() => vi.resetAllMocks());

  it('rejects duplicate emails after normalization', async () => {
    users.findByEmail.mockResolvedValue(user);
    await expect(
      service.register({ ...user, email: ' PERSON@EXAMPLE.COM ', password: 'password123' }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(users.findByEmail).toHaveBeenCalledWith('person@example.com');
    expect(users.create).not.toHaveBeenCalled();
  });

  it('does not reveal whether an account exists at login', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: user.email, password: 'password123' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password.' });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it.each(['missing', 'expired', 'revoked'] as const)('rejects a %s session', async (state) => {
    sessions.findByTokenHash.mockResolvedValue(
      state === 'missing'
        ? null
        : {
            id: 'session',
            userId: user.id,
            tokenHash: hashSessionToken('raw-token'),
            createdAt: new Date(),
            expiresAt: new Date(state === 'expired' ? 0 : Date.now() + 60_000),
            revokedAt: state === 'revoked' ? new Date() : null,
          },
    );
    expect(await service.validateSession('raw-token')).toBeNull();
    expect(sessions.findByTokenHash).toHaveBeenCalledWith(hashSessionToken('raw-token'));
    expect(users.findById).not.toHaveBeenCalled();
    expect(users.recordActivity).not.toHaveBeenCalled();
  });

  it('records successful login and authenticated use as activity', async () => {
    const authenticatedUser = { ...user, passwordHash: await hashPassword('Valid-password-123!') };
    users.findByEmail.mockResolvedValue(authenticatedUser);
    await service.login({ email: user.email, password: 'Valid-password-123!' });
    expect(users.recordActivity).toHaveBeenCalledWith(user.id, expect.any(Date));

    users.findById.mockResolvedValue(authenticatedUser);
    sessions.findByTokenHash.mockResolvedValue({
      id: 'session',
      userId: user.id,
      tokenHash: hashSessionToken('raw-token'),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    await service.validateSession('raw-token');
    expect(users.recordActivity).toHaveBeenCalledTimes(2);
  });

  it('does not send reset emails to an unverified account', async () => {
    users.findByEmail.mockResolvedValue(user);
    await service.requestPasswordReset({ email: user.email });
    expect(email.sendPasswordReset).not.toHaveBeenCalled();
    expect(sessions.createPasswordResetToken).not.toHaveBeenCalled();
  });

  it('invalidates a reset token if email delivery fails without exposing the failure', async () => {
    users.findByEmail.mockResolvedValue({ ...user, emailVerified: true });
    email.sendPasswordReset.mockRejectedValue(new Error('offline'));
    sessions.deletePasswordResetToken.mockResolvedValue();
    await expect(service.requestPasswordReset({ email: user.email })).resolves.toBeUndefined();
    expect(email.sendPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en', expiresAt: expect.any(Date) }),
    );
    expect(sessions.deletePasswordResetToken).toHaveBeenCalledWith(
      sessions.createPasswordResetToken.mock.calls[0]![0].tokenHash,
    );
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error), userId: user.id },
      'Failed to send password reset email',
    );
    expect(logger.error.mock.calls[0]![0]).not.toHaveProperty('email');
    expect(logger.error.mock.calls[0]![0]).not.toHaveProperty('displayName');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { Logger } from '../../src/infrastructure/logging/logger.js';
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
  const service = new AuthService(users, sessions, email, mock<Logger>());

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
    expect(sessions.deletePasswordResetToken).toHaveBeenCalledWith(
      sessions.createPasswordResetToken.mock.calls[0]![0].tokenHash,
    );
  });
});

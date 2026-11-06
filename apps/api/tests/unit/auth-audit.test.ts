import cookieParser from 'cookie-parser';
import express, { type RequestHandler } from 'express';
import type { DestinationStream } from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { auditEvent, type AuditEventName } from '../../src/infrastructure/logging/audit-logger.js';
import { createCategoryLogger } from '../../src/infrastructure/logging/logger.js';
import { errorHandler } from '../../src/middleware/error-handler.middleware.js';
import { AuthController } from '../../src/modules/auth/auth.controller.js';
import { createAuthRouter } from '../../src/modules/auth/auth.routes.js';
import type { AuthService } from '../../src/modules/auth/auth.service.js';
import { UserController } from '../../src/modules/users/user.controller.js';
import { createUserRouter } from '../../src/modules/users/user.routes.js';
import type { UserService } from '../../src/modules/users/user.service.js';
import { toPublicUser } from '../../src/modules/users/user.service.js';
import { AuthenticationError, ValidationError } from '../../src/shared/errors/index.js';
import { user } from '../fixtures.js';

const TOKEN = 'a'.repeat(43);
const publicUser = toPublicUser(user);

function createAuditApp() {
  const lines: string[] = [];
  const destination: DestinationStream = { write: (message) => lines.push(message) };
  const logger = createCategoryLogger('audit', destination);
  logger.level = 'info';
  const audited: typeof auditEvent = (event, options = {}) =>
    auditEvent(event, { ...options, logger });
  const requireAuth: RequestHandler = (req, _res, next) => {
    req.authUser = publicUser;
    next();
  };
  const optionalAuth: RequestHandler = requireAuth;
  const app = express();
  app.set('trust proxy', 1);
  app.use((req, _res, next) => {
    req.id = 'request-1';
    next();
  });
  app.use(express.json());
  app.use(cookieParser());

  return {
    app,
    audited,
    requireAuth,
    optionalAuth,
    records: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

function securityRequest(requestBuilder: request.Test): request.Test {
  return requestBuilder.set('x-forwarded-for', '203.0.113.10').set('user-agent', 'auth-audit-test');
}

describe('authentication audit routes', () => {
  const authService = mock<AuthService>();
  const userService = mock<UserService>();

  beforeEach(() => {
    vi.resetAllMocks();
    authService.register.mockResolvedValue({ user: publicUser, sessionToken: 'session-secret' });
    authService.login.mockResolvedValue({ user: publicUser, sessionToken: 'session-secret' });
    authService.requestPasswordReset.mockResolvedValue(user.id);
    authService.resetPassword.mockResolvedValue(user.id);
    authService.sendEmailVerification.mockResolvedValue();
    authService.verifyEmail.mockResolvedValue(user.id);
    authService.logout.mockResolvedValue();
    userService.changePassword.mockResolvedValue();
  });

  it('records every approved successful account-security event without submitted secrets', async () => {
    const { app, audited, requireAuth, optionalAuth, records } = createAuditApp();
    app.use(
      '/auth',
      createAuthRouter(new AuthController(authService), requireAuth, optionalAuth, audited),
    );
    app.use('/users', createUserRouter(new UserController(userService), requireAuth, audited));
    app.use(errorHandler);

    const registration = {
      email: user.email,
      password: 'Registration-password-123!',
      displayName: user.displayName,
      profileImage: user.profileImage,
      desiredColor: user.desiredColor,
    };
    await securityRequest(request(app).post('/auth/register')).send(registration).expect(201);
    await securityRequest(request(app).post('/auth/login'))
      .send({ email: user.email, password: 'Login-password-123!' })
      .expect(200);
    await securityRequest(request(app).post('/auth/forgot-password'))
      .send({ email: user.email })
      .expect(202);
    await securityRequest(request(app).post('/auth/reset-password'))
      .send({
        token: TOKEN,
        newPassword: 'Reset-password-123!',
        confirmNewPassword: 'Reset-password-123!',
      })
      .expect(204);
    await securityRequest(request(app).post('/auth/send-email-verification')).expect(202);
    await securityRequest(request(app).post('/auth/verify-email'))
      .send({ token: TOKEN })
      .expect(200);
    await securityRequest(request(app).post('/auth/logout'))
      .set('Cookie', 'monthloom_test_session=session-cookie-secret')
      .expect(204);
    await securityRequest(request(app).put('/users/me/password'))
      .send({
        currentPassword: 'Current-password-123!',
        newPassword: 'Changed-password-123!',
        confirmNewPassword: 'Changed-password-123!',
      })
      .expect(204);

    expect(records().map((record) => record.event)).toEqual<AuditEventName[]>([
      'auth.registration',
      'auth.login',
      'auth.password_reset_requested',
      'auth.password_reset_completed',
      'auth.email_verification_requested',
      'auth.email_verification_completed',
      'auth.logout',
      'auth.password_changed',
    ]);
    expect(records().every((record) => record.outcome === 'success')).toBe(true);
    expect(records().every((record) => record.ip === '203.0.113.10')).toBe(true);
    expect(records().every((record) => record.userAgent === 'auth-audit-test')).toBe(true);
    expect(
      records().find((record) => record.event === 'auth.password_reset_requested'),
    ).toMatchObject({ targetUserId: user.id });
    expect(
      records()
        .filter((record) => record.event !== 'auth.password_reset_requested')
        .every((record) => record.actorUserId === user.id),
    ).toBe(true);

    const serialized = JSON.stringify(records());
    for (const forbidden of [
      user.email,
      registration.password,
      'Login-password-123!',
      TOKEN,
      'session-cookie-secret',
      'Current-password-123!',
      'Changed-password-123!',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('records generic login and rejected token failures without credentials', async () => {
    authService.login.mockRejectedValue(new AuthenticationError('Invalid email or password.'));
    authService.resetPassword.mockRejectedValue(
      new ValidationError(
        'This password reset link is invalid or has expired.',
        undefined,
        'PASSWORD_RESET_TOKEN_INVALID',
      ),
    );
    authService.verifyEmail.mockRejectedValue(
      new ValidationError(
        'This email verification link is invalid or has expired.',
        undefined,
        'EMAIL_VERIFICATION_TOKEN_INVALID',
      ),
    );
    const { app, audited, requireAuth, optionalAuth, records } = createAuditApp();
    app.use(
      '/auth',
      createAuthRouter(new AuthController(authService), requireAuth, optionalAuth, audited),
    );
    app.use(errorHandler);

    await securityRequest(request(app).post('/auth/login'))
      .send({ email: user.email, password: 'Wrong-password-123!' })
      .expect(401);
    await securityRequest(request(app).post('/auth/reset-password'))
      .send({
        token: TOKEN,
        newPassword: 'Reset-password-123!',
        confirmNewPassword: 'Reset-password-123!',
      })
      .expect(400);
    await securityRequest(request(app).post('/auth/verify-email'))
      .send({ token: TOKEN })
      .expect(400);

    expect(records()).toEqual([
      expect.objectContaining({
        event: 'auth.login',
        level: 'warn',
        outcome: 'denied',
        code: 'AUTHENTICATION_ERROR',
        reason: 'INVALID_CREDENTIALS',
      }),
      expect.objectContaining({
        event: 'auth.password_reset_completed',
        level: 'warn',
        outcome: 'failure',
        reason: 'PASSWORD_RESET_TOKEN_INVALID',
      }),
      expect.objectContaining({
        event: 'auth.email_verification_completed',
        level: 'warn',
        outcome: 'failure',
        reason: 'EMAIL_VERIFICATION_TOKEN_INVALID',
      }),
    ]);
    expect(JSON.stringify(records())).not.toContain(user.email);
    expect(JSON.stringify(records())).not.toContain('Wrong-password-123!');
    expect(JSON.stringify(records())).not.toContain(TOKEN);
  });
});

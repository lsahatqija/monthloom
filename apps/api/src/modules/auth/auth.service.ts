import {
  Constants,
  Defaults,
  type ForgotPasswordRequest,
  type LoginRequest,
  type PublicUser,
  type RegisterRequest,
  type ResetPasswordRequest,
  type ChangePasswordRequest,
  type VerifyEmailRequest,
} from '@monthloom/contracts';

import { config } from '../../config/index.js';
import type { ProductEventRecorder } from '../../infrastructure/analytics/product-events.js';
import type { Logger } from '../../infrastructure/logging/logger.js';
import { hashPassword, verifyPassword } from '../../infrastructure/security/password.js';
import { generateSessionToken, hashSessionToken } from '../../infrastructure/security/tokens.js';
import { AuthenticationError, ConflictError, ValidationError } from '../../shared/errors/index.js';
import type { AutomatedEmailService } from '../email/automated-email.service.js';
import type { UserRepository } from '../users/user.repository.js';
import { toPublicUser } from '../users/user.service.js';

import type { SessionRepository } from './auth.repository.js';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface AuthResult {
  user: PublicUser;
  sessionToken: string;
}

export const PASSWORD_RESET_REQUEST_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';
export const EMAIL_VERIFICATION_SENT_MESSAGE = 'A verification link has been sent to your email.';
export const EMAIL_VERIFIED_MESSAGE = 'Your email address has been verified.';
const FAILED_LOGIN_LOCK_THRESHOLD = 5;
const FAILED_LOGIN_LOCK_MS = 15 * 60 * 1_000;

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly emailService: AutomatedEmailService,
    private readonly logger: Logger,
    private readonly productEvents?: ProductEventRecorder,
  ) {}

  async register(input: RegisterRequest): Promise<AuthResult> {
    const email = normalizeEmail(input.email);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError(
        'An account with this email already exists.',
        'EMAIL_ALREADY_REGISTERED',
      );
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.userRepository.create({
      email,
      passwordHash,
      displayName: input.displayName,
      profileImage: input.profileImage,
      desiredColor: input.desiredColor,
      locale: Defaults.USER_LOCALE,
    });

    const sessionToken = await this.createSession(user.id);
    await this.productEvents?.recordActivity(user.id);
    let verification: { tokenHash: string; url: string; expiresAt: Date } | undefined;
    try {
      verification = await this.createEmailVerificationToken(user.id);
      await this.emailService.sendWelcome({
        to: user.email,
        displayName: user.displayName,
        verificationUrl: verification.url,
        expiresAt: verification.expiresAt,
        locale: user.locale,
      });
    } catch (error) {
      if (verification) {
        await this.sessionRepository
          .deleteEmailVerificationToken(verification.tokenHash)
          .catch(() => undefined);
      }
      // A non-critical welcome email must never leave a successfully created account unusable.
      this.logger.error({ err: error, userId: user.id }, 'Failed to send welcome email');
    }
    return { user: toPublicUser(user), sessionToken };
  }

  async login(input: LoginRequest): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const user = await this.userRepository.findByEmail(email);

    // Generic message on purpose: never reveal whether the email exists.
    if (!user) {
      await this.productEvents?.record({ eventName: 'auth.login.failed' });
      throw new AuthenticationError('Invalid email or password.');
    }

    const isValid = await verifyPassword(user.passwordHash, input.password);
    if (!isValid) {
      const now = new Date();
      await this.userRepository.recordFailedLogin(
        user.id,
        now,
        FAILED_LOGIN_LOCK_THRESHOLD,
        new Date(now.getTime() + FAILED_LOGIN_LOCK_MS),
      );
      await this.productEvents?.record({ eventName: 'auth.login.failed' });
      throw new AuthenticationError('Invalid email or password.');
    }

    const now = new Date();
    if (user.suspendedAt || (user.lockedUntil && user.lockedUntil > now)) {
      await this.productEvents?.record({ eventName: 'auth.login.failed' });
      throw new AuthenticationError('Invalid email or password.');
    }

    const sessionToken = await this.createSession(user.id);
    await Promise.all([
      this.userRepository.resetFailedLogins(user.id),
      this.userRepository.recordActivity(user.id, now),
    ]);
    await Promise.all([
      this.productEvents?.record({ eventName: 'auth.login.succeeded', actorUserId: user.id }),
      this.productEvents?.recordActivity(user.id),
    ]);
    return { user: toPublicUser(user), sessionToken };
  }

  async requestPasswordReset(input: ForgotPasswordRequest): Promise<string | undefined> {
    const user = await this.userRepository.findByEmail(normalizeEmail(input.email));
    if (!user || !user.emailVerified) return;

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + Constants.PASSWORD_RESET_TTL_MS);
    await this.sessionRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    try {
      await this.emailService.sendPasswordReset({
        to: user.email,
        displayName: user.displayName,
        url: new URL(`/reset-password/${token}`, config.web.publicUrl).toString(),
        expiresAt,
        locale: user.locale,
      });
      return user.id;
    } catch (error) {
      await this.sessionRepository.deletePasswordResetToken(tokenHash).catch(() => undefined);
      this.logger.error({ err: error, userId: user.id }, 'Failed to send password reset email');
      return undefined;
    }
  }

  async resetPassword(input: ResetPasswordRequest): Promise<string> {
    const passwordHash = await hashPassword(input.newPassword);
    const reset = await this.sessionRepository.resetPassword(
      hashSessionToken(input.token),
      passwordHash,
      new Date(),
    );
    if (!reset) {
      throw new ValidationError(
        'This password reset link is invalid or has expired.',
        undefined,
        'PASSWORD_RESET_TOKEN_INVALID',
      );
    }
    return reset;
  }

  async sendEmailVerification(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.emailVerified) return;

    const verification = await this.createEmailVerificationToken(user.id);
    try {
      await this.emailService.sendAccountVerification({
        to: user.email,
        displayName: user.displayName,
        url: verification.url,
        expiresAt: verification.expiresAt,
        locale: user.locale,
      });
    } catch (error) {
      await this.sessionRepository
        .deleteEmailVerificationToken(verification.tokenHash)
        .catch(() => undefined);
      this.logger.error({ err: error, userId: user.id }, 'Failed to send email verification');
      throw error;
    }
  }

  async verifyEmail(input: VerifyEmailRequest): Promise<string> {
    const verified = await this.sessionRepository.verifyEmail(
      hashSessionToken(input.token),
      new Date(),
    );
    if (!verified) {
      throw new ValidationError(
        'This email verification link is invalid or has expired.',
        undefined,
        'EMAIL_VERIFICATION_TOKEN_INVALID',
      );
    }
    return verified;
  }

  async logout(sessionToken: string): Promise<void> {
    const tokenHash = hashSessionToken(sessionToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);
    if (session) {
      await this.sessionRepository.revoke(session.id);
    }
  }

  async changeInitialAdministratorPassword(
    userId: string,
    input: ChangePasswordRequest,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.role !== 'admin' || !user.mustChangePassword) {
      throw new ValidationError('An initial administrator password change is not required.');
    }
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new ValidationError(
        'Current password is incorrect.',
        { currentPassword: ['Current password is incorrect.'] },
        'CURRENT_PASSWORD_INCORRECT',
      );
    }
    await this.userRepository.update(user.id, {
      passwordHash: await hashPassword(input.newPassword),
      mustChangePassword: false,
    });
  }

  async validateSession(sessionToken: string): Promise<PublicUser | null> {
    const tokenHash = hashSessionToken(sessionToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const user = await this.userRepository.findById(session.userId);
    if (user?.suspendedAt || (user?.lockedUntil && user.lockedUntil > new Date())) {
      await this.sessionRepository.revoke(session.id);
      return null;
    }
    if (user) {
      const now = new Date();
      await Promise.all([
        this.userRepository.recordActivity(user.id, now),
        this.productEvents?.recordActivity(user.id, now),
      ]);
    }
    return user ? toPublicUser(user) : null;
  }

  private async createSession(userId: string): Promise<string> {
    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + config.session.durationHours * 60 * 60 * 1000);

    await this.sessionRepository.create({ userId, tokenHash, expiresAt });
    return sessionToken;
  }

  private async createEmailVerificationToken(
    userId: string,
  ): Promise<{ tokenHash: string; url: string; expiresAt: Date }> {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + Constants.EMAIL_VERIFICATION_TTL_MS);
    await this.sessionRepository.createEmailVerificationToken({
      userId,
      tokenHash,
      expiresAt,
    });
    return {
      tokenHash,
      url: new URL(`/verify-email/${token}`, config.web.publicUrl).toString(),
      expiresAt,
    };
  }
}

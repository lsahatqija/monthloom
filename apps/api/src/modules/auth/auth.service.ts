import {
  Constants,
  type ForgotPasswordRequest,
  type LoginRequest,
  type PublicUser,
  type RegisterRequest,
  type ResetPasswordRequest,
} from '@template/contracts';

import { config } from '../../config/index.js';
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

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly emailService: AutomatedEmailService,
    private readonly logger: Logger,
  ) {}

  async register(input: RegisterRequest): Promise<AuthResult> {
    const email = normalizeEmail(input.email);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('An account with this email already exists.');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.userRepository.create({
      email,
      passwordHash,
      displayName: input.displayName,
      profileImage: input.profileImage,
      desiredColor: input.desiredColor,
    });

    const sessionToken = await this.createSession(user.id);
    try {
      await this.emailService.sendWelcome({
        to: user.email,
        displayName: user.displayName,
        dashboardUrl: new URL('/dashboard', config.web.publicUrl).toString(),
      });
    } catch (error) {
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
      throw new AuthenticationError('Invalid email or password.');
    }

    const isValid = await verifyPassword(user.passwordHash, input.password);
    if (!isValid) {
      throw new AuthenticationError('Invalid email or password.');
    }

    const sessionToken = await this.createSession(user.id);
    return { user: toPublicUser(user), sessionToken };
  }

  async requestPasswordReset(input: ForgotPasswordRequest): Promise<void> {
    const user = await this.userRepository.findByEmail(normalizeEmail(input.email));
    if (!user) return;

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
        expiresIn: '1 hour',
      });
    } catch (error) {
      await this.sessionRepository.deletePasswordResetToken(tokenHash).catch(() => undefined);
      this.logger.error({ err: error, userId: user.id }, 'Failed to send password reset email');
    }
  }

  async resetPassword(input: ResetPasswordRequest): Promise<void> {
    const passwordHash = await hashPassword(input.newPassword);
    const reset = await this.sessionRepository.resetPassword(
      hashSessionToken(input.token),
      passwordHash,
      new Date(),
    );
    if (!reset) {
      throw new ValidationError('This password reset link is invalid or has expired.');
    }
  }

  async logout(sessionToken: string): Promise<void> {
    const tokenHash = hashSessionToken(sessionToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);
    if (session) {
      await this.sessionRepository.revoke(session.id);
    }
  }

  async validateSession(sessionToken: string): Promise<PublicUser | null> {
    const tokenHash = hashSessionToken(sessionToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);

    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      return null;
    }

    const user = await this.userRepository.findById(session.userId);
    return user ? toPublicUser(user) : null;
  }

  private async createSession(userId: string): Promise<string> {
    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + config.session.durationHours * 60 * 60 * 1000);

    await this.sessionRepository.create({ userId, tokenHash, expiresAt });
    return sessionToken;
  }
}

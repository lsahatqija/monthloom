import type {
  CreateEmailVerificationTokenData,
  CreatePasswordResetTokenData,
  CreateSessionData,
  Session,
} from './auth.types.js';

/** Business-oriented persistence operations for authentication sessions. */
export interface SessionRepository {
  create(input: CreateSessionData): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string, now: Date): Promise<void>;
  createPasswordResetToken(input: CreatePasswordResetTokenData): Promise<void>;
  deletePasswordResetToken(tokenHash: string): Promise<void>;
  resetPassword(tokenHash: string, passwordHash: string, now: Date): Promise<string | null>;
  createEmailVerificationToken(input: CreateEmailVerificationTokenData): Promise<void>;
  deleteEmailVerificationToken(tokenHash: string): Promise<void>;
  verifyEmail(tokenHash: string, now: Date): Promise<string | null>;
}

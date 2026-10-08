import { and, eq, gt, isNull } from 'drizzle-orm';

import type { Database } from '../../../infrastructure/database/client.js';
import {
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  users,
} from '../../../infrastructure/database/schema.js';
import type { SessionRepository } from '../auth.repository.js';
import type {
  CreateEmailVerificationTokenData,
  CreatePasswordResetTokenData,
  CreateSessionData,
  Session,
} from '../auth.types.js';

function toDomainSession(record: typeof sessions.$inferSelect): Session {
  return {
    id: record.id,
    userId: record.userId,
    tokenHash: record.tokenHash,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    revokedAt: record.revokedAt,
  };
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateSessionData): Promise<Session> {
    const [record] = await this.db
      .insert(sessions)
      .values({ userId: input.userId, tokenHash: input.tokenHash, expiresAt: input.expiresAt })
      .returning();

    if (!record) {
      throw new Error('Failed to create session.');
    }

    return toDomainSession(record);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const [record] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);

    return record ? toDomainSession(record) : null;
  }

  async revoke(id: string): Promise<void> {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, id));
  }

  async createPasswordResetToken(input: CreatePasswordResetTokenData): Promise<void> {
    await this.db.insert(passwordResetTokens).values(input);
  }

  async deletePasswordResetToken(tokenHash: string): Promise<void> {
    await this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
  }

  async resetPassword(tokenHash: string, passwordHash: string, now: Date): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [token] = await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, now),
          ),
        )
        .returning({ userId: passwordResetTokens.userId });

      if (!token) return false;

      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(eq(passwordResetTokens.userId, token.userId), isNull(passwordResetTokens.usedAt)),
        );
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(users.id, token.userId));
      await tx
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.userId, token.userId), isNull(sessions.revokedAt)));

      return true;
    });
  }

  async createEmailVerificationToken(input: CreateEmailVerificationTokenData): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, input.userId));
      await tx.insert(emailVerificationTokens).values(input);
    });
  }

  async deleteEmailVerificationToken(tokenHash: string): Promise<void> {
    await this.db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash));
  }

  async verifyEmail(tokenHash: string, now: Date): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [token] = await tx
        .delete(emailVerificationTokens)
        .where(
          and(
            eq(emailVerificationTokens.tokenHash, tokenHash),
            gt(emailVerificationTokens.expiresAt, now),
          ),
        )
        .returning({ userId: emailVerificationTokens.userId });
      if (!token) return false;

      await tx
        .update(users)
        .set({ emailVerified: true, updatedAt: now })
        .where(eq(users.id, token.userId));
      await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, token.userId));
      return true;
    });
  }
}

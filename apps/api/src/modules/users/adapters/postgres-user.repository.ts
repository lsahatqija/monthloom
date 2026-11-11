import { localeSchema } from '@monthloom/contracts';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';

import type { Database } from '../../../infrastructure/database/client.js';
import { users } from '../../../infrastructure/database/schema/index.js';
import type { UserRepository } from '../user.repository.js';
import type { CreateUserData, UpdateUserData, User } from '../user.types.js';

const ACTIVITY_WRITE_INTERVAL_MS = 15 * 60 * 1_000;

function toDomainUser(record: typeof users.$inferSelect): User {
  return {
    id: record.id,
    email: record.email,
    emailVerified: record.emailVerified,
    passwordHash: record.passwordHash,
    displayName: record.displayName,
    profileImage: record.profileImage,
    desiredColor: record.desiredColor,
    locale: localeSchema.parse(record.locale),
    role: record.role,
    mustChangePassword: record.mustChangePassword,
    failedLoginAttempts: record.failedLoginAttempts,
    lockedUntil: record.lockedUntil,
    suspendedAt: record.suspendedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const [record] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return record ? toDomainUser(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [record] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return record ? toDomainUser(record) : null;
  }

  async create(input: CreateUserData): Promise<User> {
    const [record] = await this.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        profileImage: input.profileImage,
        desiredColor: input.desiredColor,
        locale: input.locale,
        role: input.role ?? 'user',
        mustChangePassword: input.mustChangePassword ?? false,
      })
      .returning();

    if (!record) {
      throw new Error('Failed to create user.');
    }

    return toDomainUser(record);
  }

  async update(id: string, input: UpdateUserData): Promise<User> {
    const [record] = await this.db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!record) {
      throw new Error('Failed to update user: not found.');
    }

    return toDomainUser(record);
  }

  async recordActivity(id: string, now: Date): Promise<void> {
    const cutoff = new Date(now.getTime() - ACTIVITY_WRITE_INTERVAL_MS);
    await this.db
      .update(users)
      .set({ lastActiveAt: now })
      .where(and(eq(users.id, id), or(isNull(users.lastActiveAt), lt(users.lastActiveAt, cutoff))));
  }

  async recordFailedLogin(
    id: string,
    now: Date,
    threshold: number,
    lockedUntil: Date,
  ): Promise<void> {
    await this.db.execute(sql`
      UPDATE users SET
        failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts + 1 >= ${threshold} THEN ${lockedUntil}
          ELSE locked_until
        END,
        updated_at = ${now}
      WHERE id = ${id}
    `);
  }

  async resetFailedLogins(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(users.id, id));
  }
}

import { Constants, Defaults } from '@monthloom/contracts';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [...Constants.USER_ROLES]);
export const profileImageEnum = pgEnum('profile_image', [...Constants.PROFILE_IMAGES]);
export const desiredColorEnum = pgEnum('desired_color', [...Constants.DESIRED_COLORS]);
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: Constants.EMAIL_MAX_LENGTH }).notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: Constants.DISPLAY_NAME_MAX_LENGTH }).notNull(),
    profileImage: profileImageEnum('profile_image').notNull().default(Defaults.USER_PROFILE_IMAGE),
    desiredColor: desiredColorEnum('desired_color').notNull().default(Defaults.USER_DESIRED_COLOR),
    role: userRoleEnum('role').notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUniqueIdx: uniqueIndex('users_email_unique_idx').on(table.email),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex('sessions_token_hash_unique_idx').on(table.tokenHash),
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
  }),
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex('password_reset_tokens_token_hash_unique_idx').on(
      table.tokenHash,
    ),
    userIdIdx: index('password_reset_tokens_user_id_idx').on(table.userId),
    expiresAtIdx: index('password_reset_tokens_expires_at_idx').on(table.expiresAt),
  }),
);

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex('email_verification_tokens_token_hash_unique_idx').on(
      table.tokenHash,
    ),
    userIdIdx: index('email_verification_tokens_user_id_idx').on(table.userId),
    expiresAtIdx: index('email_verification_tokens_expires_at_idx').on(table.expiresAt),
  }),
);

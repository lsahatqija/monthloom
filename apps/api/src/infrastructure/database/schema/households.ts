import { Constants, Defaults } from '@monthloom/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './identity.js';

export const householdIconEnum = pgEnum('household_icon', [...Constants.HOUSEHOLD_ICONS]);

export const households = pgTable(
  'households',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: Constants.HOUSEHOLD_NAME_MAX_LENGTH }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    icon: householdIconEnum('icon').notNull().default(Defaults.HOUSEHOLD_ICON),
    color: varchar('color', { length: 7 })
      .notNull()
      .default(Defaults.HOUSEHOLD_COLOR.toLowerCase()),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    currencyFormatCheck: check(
      'households_currency_format_check',
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    colorFormatCheck: check(
      'households_color_format_check',
      sql`${table.color} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    ownerIdIdx: index('households_owner_id_idx').on(table.ownerId),
  }),
);

export const householdMembers = pgTable(
  'household_members',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.householdId, table.userId] }),
    userIdIdx: index('household_members_user_id_idx').on(table.userId),
    primaryHouseholdUniqueIdx: uniqueIndex('household_members_primary_user_unique_idx')
      .on(table.userId)
      .where(sql`${table.isPrimary}`),
  }),
);

export const householdInvitations = pgTable(
  'household_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedById: uuid('accepted_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex('household_invitations_token_hash_unique_idx').on(
      table.tokenHash,
    ),
    householdIdIdx: index('household_invitations_household_id_idx').on(table.householdId),
    expiresAtIdx: index('household_invitations_expires_at_idx').on(table.expiresAt),
  }),
);

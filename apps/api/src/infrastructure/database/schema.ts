import { Constants } from '@template/contracts';
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [...Constants.USER_ROLES]);
export const profileImageEnum = pgEnum('profile_image', [...Constants.PROFILE_IMAGES]);
export const desiredColorEnum = pgEnum('desired_color', [...Constants.DESIRED_COLORS]);
export const financialIconEnum = pgEnum('financial_icon', [...Constants.FINANCIAL_ICONS]);
export const expenseTypeEnum = pgEnum('expense_type', [...Constants.EXPENSE_TYPES]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: Constants.EMAIL_MAX_LENGTH }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: Constants.DISPLAY_NAME_MAX_LENGTH }).notNull(),
    profileImage: profileImageEnum('profile_image')
      .notNull()
      .default(Constants.DEFAULT_PROFILE_IMAGE),
    desiredColor: desiredColorEnum('desired_color')
      .notNull()
      .default(Constants.DEFAULT_DESIRED_COLOR),
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

export const files = pgTable(
  'files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    storageKey: varchar('storage_key', { length: 255 }).notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: integer('size').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    storageKeyUniqueIdx: uniqueIndex('files_storage_key_unique_idx').on(table.storageKey),
    ownerIdIdx: index('files_owner_id_idx').on(table.ownerId),
  }),
);

export const households = pgTable(
  'households',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: Constants.HOUSEHOLD_NAME_MAX_LENGTH }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    icon: financialIconEnum('icon').notNull().default('house'),
    color: varchar('color', { length: 7 }).notNull().default('#35675b'),
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

export const sources = pgTable(
  'sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: Constants.DISPLAY_NAME_MAX_LENGTH }).notNull(),
    nameKey: varchar('name_key', { length: Constants.DISPLAY_NAME_MAX_LENGTH }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    householdIdIdx: index('sources_household_id_idx').on(table.householdId),
    householdNameKeyUniqueIdx: uniqueIndex('sources_household_name_key_unique_idx').on(
      table.householdId,
      table.nameKey,
    ),
    householdAndIdUniqueIdx: uniqueIndex('sources_household_id_id_unique_idx').on(
      table.householdId,
      table.id,
    ),
  }),
);

export const incomes = pgTable(
  'incomes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    icon: financialIconEnum('icon').notNull(),
    color: varchar('color', { length: 7 }).notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    recurring: boolean('recurring').notNull().default(false),
    expiresOn: date('expires_on', { mode: 'string' }),
    recurrenceId: uuid('recurrence_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    householdDateIdx: index('incomes_household_date_idx').on(table.householdId, table.date),
    userIdIdx: index('incomes_user_id_idx').on(table.userId),
    sourceIdIdx: index('incomes_source_id_idx').on(table.sourceId),
    recurrenceIdIdx: index('incomes_recurrence_id_idx').on(table.recurrenceId),
    positiveAmountCheck: check('incomes_positive_amount_check', sql`${table.amount} > 0`),
    colorFormatCheck: check(
      'incomes_color_format_check',
      sql`${table.color} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    householdSourceFk: foreignKey({
      columns: [table.householdId, table.sourceId],
      foreignColumns: [sources.householdId, sources.id],
      name: 'incomes_household_source_fk',
    }).onDelete('no action'),
  }),
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: expenseTypeEnum('type').notNull(),
    icon: financialIconEnum('icon').notNull(),
    color: varchar('color', { length: 7 }).notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    recurring: boolean('recurring').notNull().default(false),
    expiresOn: date('expires_on', { mode: 'string' }),
    recurrenceId: uuid('recurrence_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    householdDateIdx: index('expenses_household_date_idx').on(table.householdId, table.date),
    householdTypeIdx: index('expenses_household_type_idx').on(table.householdId, table.type),
    userIdIdx: index('expenses_user_id_idx').on(table.userId),
    sourceIdIdx: index('expenses_source_id_idx').on(table.sourceId),
    recurrenceIdIdx: index('expenses_recurrence_id_idx').on(table.recurrenceId),
    positiveAmountCheck: check('expenses_positive_amount_check', sql`${table.amount} > 0`),
    colorFormatCheck: check(
      'expenses_color_format_check',
      sql`${table.color} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    householdSourceFk: foreignKey({
      columns: [table.householdId, table.sourceId],
      foreignColumns: [sources.householdId, sources.id],
      name: 'expenses_household_source_fk',
    }).onDelete('no action'),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  files: many(files),
  householdMemberships: many(householdMembers),
  incomes: many(incomes),
  expenses: many(expenses),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  owner: one(users, { fields: [files.ownerId], references: [users.id] }),
}));

export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  invitations: many(householdInvitations),
  sources: many(sources),
  incomes: many(incomes),
  expenses: many(expenses),
}));

export const householdInvitationsRelations = relations(householdInvitations, ({ one }) => ({
  household: one(households, {
    fields: [householdInvitations.householdId],
    references: [households.id],
  }),
  createdBy: one(users, {
    fields: [householdInvitations.createdById],
    references: [users.id],
    relationName: 'createdHouseholdInvitations',
  }),
  acceptedBy: one(users, {
    fields: [householdInvitations.acceptedById],
    references: [users.id],
    relationName: 'acceptedHouseholdInvitations',
  }),
}));

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
  user: one(users, { fields: [householdMembers.userId], references: [users.id] }),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  household: one(households, { fields: [sources.householdId], references: [households.id] }),
  incomes: many(incomes),
  expenses: many(expenses),
}));

export const incomesRelations = relations(incomes, ({ one }) => ({
  household: one(households, { fields: [incomes.householdId], references: [households.id] }),
  source: one(sources, { fields: [incomes.sourceId], references: [sources.id] }),
  user: one(users, { fields: [incomes.userId], references: [users.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  household: one(households, { fields: [expenses.householdId], references: [households.id] }),
  source: one(sources, { fields: [expenses.sourceId], references: [sources.id] }),
  user: one(users, { fields: [expenses.userId], references: [users.id] }),
}));

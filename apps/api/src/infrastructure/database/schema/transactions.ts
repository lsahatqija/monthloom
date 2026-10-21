import { Constants } from '@monthloom/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { households } from './households.js';
import { users } from './identity.js';

export const financialIconEnum = pgEnum('financial_icon', [...Constants.FINANCIAL_ICONS]);
export const expenseTypeEnum = pgEnum('expense_type', [...Constants.EXPENSE_TYPES]);
export const recurrenceUnitEnum = pgEnum('recurrence_unit', [...Constants.RECURRENCE_UNITS]);

export const sources = pgTable(
  'sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: Constants.DISPLAY_NAME_MAX_LENGTH }).notNull(),
    key: varchar('name_key', { length: Constants.DISPLAY_NAME_MAX_LENGTH }).notNull(),
    aliases: varchar('aliases', { length: Constants.DISPLAY_NAME_MAX_LENGTH })
      .array()
      .notNull()
      .default(sql`ARRAY[]::varchar[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    householdIdIdx: index('sources_household_id_idx').on(table.householdId),
    householdNameKeyUniqueIdx: uniqueIndex('sources_household_name_key_unique_idx').on(
      table.householdId,
      table.key,
    ),
    aliasesIncludeDisplayNameCheck: check(
      'sources_aliases_include_display_name_check',
      sql`${table.displayName} = ANY(${table.aliases})`,
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
    recurrenceInterval: integer('recurrence_interval').notNull().default(1),
    recurrenceUnit: recurrenceUnitEnum('recurrence_unit').notNull().default('month'),
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
    recurrenceIntervalCheck: check(
      'incomes_recurrence_interval_check',
      sql`${table.recurrenceInterval} BETWEEN 1 AND 99`,
    ),
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
    recurrenceInterval: integer('recurrence_interval').notNull().default(1),
    recurrenceUnit: recurrenceUnitEnum('recurrence_unit').notNull().default('month'),
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
    recurrenceIntervalCheck: check(
      'expenses_recurrence_interval_check',
      sql`${table.recurrenceInterval} BETWEEN 1 AND 99`,
    ),
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

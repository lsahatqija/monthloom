import { sql } from 'drizzle-orm';
import {
  date,
  integer,
  index,
  jsonb,
  pgTable,
  timestamp,
  bigint,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const productEvents = pgTable(
  'product_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventName: varchar('event_name', { length: 80 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid('actor_user_id'),
    householdId: uuid('household_id'),
    subjectId: uuid('subject_id'),
    subjectKind: varchar('subject_kind', { length: 40 }),
    activityDate: date('activity_date', { mode: 'string' }),
    metadata: jsonb('metadata')
      .$type<Record<string, string | number | boolean>>()
      .notNull()
      .default({}),
  },
  (table) => ({
    eventOccurredIdx: index('product_events_event_occurred_idx').on(
      table.eventName,
      table.occurredAt,
    ),
    actorOccurredIdx: index('product_events_actor_occurred_idx').on(
      table.actorUserId,
      table.occurredAt,
    ),
    householdOccurredIdx: index('product_events_household_occurred_idx').on(
      table.householdId,
      table.occurredAt,
    ),
    dailyActivityUniqueIdx: uniqueIndex('product_events_daily_activity_unique_idx')
      .on(table.actorUserId, table.activityDate)
      .where(sql`${table.eventName} = 'user.active'`),
  }),
);

export const requestHourlyRollups = pgTable(
  'request_hourly_rollups',
  {
    hour: timestamp('hour', { withTimezone: true }).notNull(),
    method: varchar('method', { length: 10 }).notNull(),
    route: varchar('route', { length: 160 }).notNull(),
    statusClass: integer('status_class').notNull(),
    applicationVersion: varchar('application_version', { length: 40 }).notNull(),
    clientVersion: varchar('client_version', { length: 40 }).notNull().default('unknown'),
    requestCount: integer('request_count').notNull().default(0),
    durationTotalMs: bigint('duration_total_ms', { mode: 'number' }).notNull().default(0),
    durationMaxMs: integer('duration_max_ms').notNull().default(0),
    databaseTotalMs: bigint('database_total_ms', { mode: 'number' }).notNull().default(0),
  },
  (table) => ({
    identity: uniqueIndex('request_hourly_rollups_identity_idx').on(
      table.hour,
      table.method,
      table.route,
      table.statusClass,
      table.applicationVersion,
      table.clientVersion,
    ),
    range: index('request_hourly_rollups_range_idx').on(table.hour),
  }),
);

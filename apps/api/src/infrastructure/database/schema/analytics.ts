import { sql } from 'drizzle-orm';
import {
  date,
  index,
  jsonb,
  pgTable,
  timestamp,
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

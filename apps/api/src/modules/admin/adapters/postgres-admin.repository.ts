import type { AdminResolvedRange, AdminUsageResponse } from '@monthloom/contracts';
import { and, count, countDistinct, gt, gte, isNull, sql } from 'drizzle-orm';

import type { Database } from '../../../infrastructure/database/client.js';
import {
  expenses,
  households,
  incomes,
  sessions,
  users,
} from '../../../infrastructure/database/schema/index.js';
import { adminCalendarBuckets } from '../admin-range.js';
import type { AdminMetrics, AdminRepository } from '../admin.repository.js';

export class PostgresAdminRepository implements AdminRepository {
  constructor(private readonly db: Database) {}

  async getMetrics(now: Date): Promise<AdminMetrics> {
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
    const [
      [userCount],
      [dailyActiveUserCount],
      [weeklyActiveUserCount],
      [monthlyActiveUserCount],
      [currentlyLoggedInUserCount],
      [householdCount],
      [incomeCount],
      [expenseCount],
    ] = await Promise.all([
      this.db.select({ value: count() }).from(users),
      this.db.select({ value: count() }).from(users).where(gte(users.lastActiveAt, dayAgo)),
      this.db.select({ value: count() }).from(users).where(gte(users.lastActiveAt, weekAgo)),
      this.db.select({ value: count() }).from(users).where(gte(users.lastActiveAt, monthAgo)),
      this.db
        .select({ value: countDistinct(sessions.userId) })
        .from(sessions)
        .where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, now))),
      this.db.select({ value: count() }).from(households),
      this.db.select({ value: count() }).from(incomes),
      this.db.select({ value: count() }).from(expenses),
    ]);

    return {
      totalUsers: userCount?.value ?? 0,
      dailyActiveUsers: dailyActiveUserCount?.value ?? 0,
      weeklyActiveUsers: weeklyActiveUserCount?.value ?? 0,
      monthlyActiveUsers: monthlyActiveUserCount?.value ?? 0,
      currentlyLoggedInUsers: currentlyLoggedInUserCount?.value ?? 0,
      households: householdCount?.value ?? 0,
      incomes: incomeCount?.value ?? 0,
      expenses: expenseCount?.value ?? 0,
    };
  }

  async getUsage(
    range: AdminResolvedRange,
    comparisonRange: AdminResolvedRange,
  ): Promise<Omit<AdminUsageResponse, 'generatedAt' | 'range' | 'comparisonRange'>> {
    const [
      current,
      previous,
      seriesResult,
      operationsResult,
      mixResult,
      expenseTypesResult,
      engagementResult,
      coverageResult,
    ] = await Promise.all([
      this.getUsageTotals(range),
      this.getUsageTotals(comparisonRange),
      this.db.execute<UsageSeriesRow>(sql`
          SELECT floor((((occurred_at AT TIME ZONE ${range.timezone})::date - ${range.from}::date) / ${range.bucket === 'day' ? 1 : 7}))::int AS bucket_index,
            count(DISTINCT actor_user_id) FILTER (WHERE event_name = 'user.active')::int AS active_users,
            count(DISTINCT household_id) FILTER (WHERE household_id IS NOT NULL)::int AS active_households,
            count(*) FILTER (WHERE event_name = 'transaction.created')::int AS transactions_created,
            count(*) FILTER (WHERE event_name = 'transaction.updated')::int AS transactions_updated,
            count(*) FILTER (WHERE event_name = 'transaction.deleted')::int AS transactions_deleted,
            count(*) FILTER (WHERE event_name = 'user.registered')::int AS registrations
          FROM product_events
          WHERE occurred_at >= ${new Date(range.start)} AND occurred_at < ${new Date(range.endExclusive)}
          GROUP BY bucket_index ORDER BY bucket_index
        `),
      this.db.execute<OperationRow>(sql`
          SELECT
            count(*) FILTER (WHERE event_name = 'transaction.created')::int AS created,
            count(*) FILTER (WHERE event_name = 'transaction.updated')::int AS updated,
            count(*) FILTER (WHERE event_name = 'transaction.deleted')::int AS deleted,
            count(*) FILTER (WHERE event_name = 'transaction.created' AND subject_kind = 'income')::int AS incomes,
            count(*) FILTER (WHERE event_name = 'transaction.created' AND subject_kind = 'expense')::int AS expenses
          FROM product_events
          WHERE occurred_at >= ${new Date(range.start)} AND occurred_at < ${new Date(range.endExclusive)}
        `),
      this.db.execute<TransactionMixRow>(sql`
          WITH records AS (
            SELECT 'income'::text AS kind, h.currency, i.amount, i.recurring, NULL::text AS expense_type
            FROM incomes i JOIN households h ON h.id = i.household_id
            WHERE i.created_at >= ${new Date(range.start)} AND i.created_at < ${new Date(range.endExclusive)}
            UNION ALL
            SELECT 'expense', h.currency, e.amount, e.recurring, e.type::text
            FROM expenses e JOIN households h ON h.id = e.household_id
            WHERE e.created_at >= ${new Date(range.start)} AND e.created_at < ${new Date(range.endExclusive)}
          )
          SELECT kind, currency, count(*)::int AS count, sum(amount)::text AS amount,
            avg(amount)::text AS average,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)::text AS median,
            count(*) FILTER (WHERE recurring)::int AS recurring,
            count(*) FILTER (WHERE NOT recurring)::int AS one_off
          FROM records GROUP BY kind, currency ORDER BY currency, kind
        `),
      this.db.execute<ExpenseTypeRow>(sql`
          SELECT type::text, count(*)::int AS count FROM expenses
          WHERE created_at >= ${new Date(range.start)} AND created_at < ${new Date(range.endExclusive)}
          GROUP BY type ORDER BY count DESC, type
        `),
      this.db.execute<EngagementRow>(sql`
          WITH days AS (
            SELECT generate_series(${range.from}::date, ${range.to}::date, interval '1 day')::date AS day
          ), daily AS (
            SELECT d.day,
              count(DISTINCT e.actor_user_id) FILTER (WHERE (e.occurred_at AT TIME ZONE ${range.timezone})::date = d.day) AS dau,
              count(DISTINCT e.actor_user_id) AS mau
            FROM days d LEFT JOIN product_events e ON e.event_name = 'user.active'
              AND (e.occurred_at AT TIME ZONE ${range.timezone})::date BETWEEN d.day - 29 AND d.day
            GROUP BY d.day
          ), cohort AS (
            SELECT actor_user_id, (occurred_at AT TIME ZONE ${range.timezone})::date AS registered_date
            FROM product_events WHERE event_name = 'user.registered'
              AND occurred_at >= ${new Date(range.start)} AND occurred_at < ${new Date(range.endExclusive)}
          )
          SELECT
            (SELECT avg(CASE WHEN mau > 0 THEN dau::numeric / mau * 100 END)::float8 FROM daily) AS stickiness,
            (SELECT count(*) FROM users WHERE created_at < ${new Date(range.endExclusive)})::int AS eligible_users,
            (SELECT count(*) FROM households WHERE created_at < ${new Date(range.endExclusive)})::int AS eligible_households,
            count(*) FILTER (WHERE registered_date <= ${range.to}::date - 7)::int AS d7_eligible,
            count(*) FILTER (WHERE registered_date <= ${range.to}::date - 7 AND EXISTS (
              SELECT 1 FROM product_events a WHERE a.event_name = 'user.active' AND a.actor_user_id = cohort.actor_user_id
                AND (a.occurred_at AT TIME ZONE ${range.timezone})::date = registered_date + 7
            ))::int AS d7_returned,
            count(*) FILTER (WHERE registered_date <= ${range.to}::date - 30)::int AS d30_eligible,
            count(*) FILTER (WHERE registered_date <= ${range.to}::date - 30 AND EXISTS (
              SELECT 1 FROM product_events a WHERE a.event_name = 'user.active' AND a.actor_user_id = cohort.actor_user_id
                AND (a.occurred_at AT TIME ZONE ${range.timezone})::date = registered_date + 30
            ))::int AS d30_returned
          FROM cohort
        `),
      this.db.execute<{ occurred_at: Date }>(sql`
          SELECT occurred_at FROM product_events WHERE event_name = 'analytics.collection_started'
          ORDER BY occurred_at LIMIT 1
        `),
    ]);

    const operations = operationsResult.rows[0] ?? emptyOperations();
    const totalKinds = operations.incomes + operations.expenses;
    const mixRows = mixResult.rows;
    const engagement = engagementResult.rows[0];

    return {
      summary: {
        activeUsers: compared(current.activeUsers, previous.activeUsers),
        newUsers: compared(current.newUsers, previous.newUsers),
        activeHouseholds: compared(current.activeHouseholds, previous.activeHouseholds),
        transactionsCreated: compared(current.transactionsCreated, previous.transactionsCreated),
        transactionsPerActiveHousehold: compared(
          ratio(current.transactionsCreated, current.activeHouseholds),
          ratio(previous.transactionsCreated, previous.activeHouseholds),
        ),
      },
      series: adminCalendarBuckets(range).map((bucket, index) => {
        const row = seriesResult.rows.find((candidate) => candidate.bucket_index === index);
        return {
          ...bucket,
          activeUsers: row?.active_users ?? 0,
          activeHouseholds: row?.active_households ?? 0,
          transactionsCreated: row?.transactions_created ?? 0,
          transactionsUpdated: row?.transactions_updated ?? 0,
          transactionsDeleted: row?.transactions_deleted ?? 0,
          registrations: row?.registrations ?? 0,
        };
      }),
      transactionMix: {
        operations: {
          created: operations.created,
          updated: operations.updated,
          deleted: operations.deleted,
        },
        kinds: [
          {
            kind: 'income',
            count: operations.incomes,
            percentage: percent(operations.incomes, totalKinds),
            previousCount: previous.incomes,
            changePercent: changePercent(operations.incomes, previous.incomes),
          },
          {
            kind: 'expense',
            count: operations.expenses,
            percentage: percent(operations.expenses, totalKinds),
            previousCount: previous.expenses,
            changePercent: changePercent(operations.expenses, previous.expenses),
          },
        ],
        currencies: mixRows.map((row) => ({
          currency: row.currency,
          kind: row.kind,
          count: row.count,
          amount: decimal(row.amount),
          average: decimal(row.average),
          median: decimal(row.median),
        })),
        recurrence: {
          recurring: mixRows.reduce((sum, row) => sum + row.recurring, 0),
          oneOff: mixRows.reduce((sum, row) => sum + row.one_off, 0),
        },
        expenseTypes: expenseTypesResult.rows,
      },
      engagement: {
        stickiness: nullableNumber(engagement?.stickiness),
        transactionsPerActiveUser: nullableRatio(current.transactionsCreated, current.activeUsers),
        registeredUserActivityRate: nullablePercent(
          current.activeUsers,
          engagement?.eligible_users,
        ),
        activeHouseholdRate: nullablePercent(
          current.activeHouseholds,
          engagement?.eligible_households,
        ),
        returningAfter7Days: nullablePercent(engagement?.d7_returned, engagement?.d7_eligible),
        returningAfter30Days: nullablePercent(engagement?.d30_returned, engagement?.d30_eligible),
      },
      coverageStartedAt: new Date(coverageResult.rows[0]?.occurred_at ?? Date.now()).toISOString(),
    };
  }

  private async getUsageTotals(range: AdminResolvedRange): Promise<UsageTotals> {
    const result = await this.db.execute<UsageTotals>(sql`
      SELECT
        count(DISTINCT actor_user_id) FILTER (WHERE event_name = 'user.active')::int AS "activeUsers",
        count(*) FILTER (WHERE event_name = 'user.registered')::int AS "newUsers",
        count(DISTINCT household_id) FILTER (WHERE household_id IS NOT NULL)::int AS "activeHouseholds",
        count(*) FILTER (WHERE event_name = 'transaction.created')::int AS "transactionsCreated",
        count(*) FILTER (WHERE event_name = 'transaction.created' AND subject_kind = 'income')::int AS incomes,
        count(*) FILTER (WHERE event_name = 'transaction.created' AND subject_kind = 'expense')::int AS expenses
      FROM product_events
      WHERE occurred_at >= ${new Date(range.start)} AND occurred_at < ${new Date(range.endExclusive)}
    `);
    return (
      result.rows[0] ?? {
        activeUsers: 0,
        newUsers: 0,
        activeHouseholds: 0,
        transactionsCreated: 0,
        incomes: 0,
        expenses: 0,
      }
    );
  }
}

interface UsageTotals extends Record<string, unknown> {
  activeUsers: number;
  newUsers: number;
  activeHouseholds: number;
  transactionsCreated: number;
  incomes: number;
  expenses: number;
}
interface UsageSeriesRow extends Record<string, unknown> {
  bucket_index: number;
  active_users: number;
  active_households: number;
  transactions_created: number;
  transactions_updated: number;
  transactions_deleted: number;
  registrations: number;
}
interface OperationRow extends Record<string, unknown> {
  created: number;
  updated: number;
  deleted: number;
  incomes: number;
  expenses: number;
}
interface TransactionMixRow extends Record<string, unknown> {
  kind: 'income' | 'expense';
  currency: string;
  count: number;
  amount: string | null;
  average: string | null;
  median: string | null;
  recurring: number;
  one_off: number;
}
interface ExpenseTypeRow extends Record<string, unknown> {
  type: string;
  count: number;
}
interface EngagementRow extends Record<string, unknown> {
  stickiness: number | null;
  eligible_users: number;
  eligible_households: number;
  d7_eligible: number;
  d7_returned: number;
  d30_eligible: number;
  d30_returned: number;
}

function emptyOperations(): OperationRow {
  return { created: 0, updated: 0, deleted: 0, incomes: 0, expenses: 0 };
}
function ratio(value: number, denominator: number): number {
  return denominator ? value / denominator : 0;
}
function percent(value: number, denominator: number): number {
  return denominator ? (value / denominator) * 100 : 0;
}
function nullableRatio(value?: number, denominator?: number): number | null {
  return denominator ? (value ?? 0) / denominator : null;
}
function nullablePercent(value?: number, denominator?: number): number | null {
  return denominator ? ((value ?? 0) / denominator) * 100 : null;
}
function nullableNumber(value?: number | null): number | null {
  return value == null ? null : Number(value);
}
function decimal(value: string | null): string {
  return Number(value ?? 0).toFixed(2);
}
function compared(current: number, previous: number) {
  return {
    current,
    previous,
    changePercent:
      previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100,
  };
}

function changePercent(current: number, previous: number): number | null {
  return previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100;
}

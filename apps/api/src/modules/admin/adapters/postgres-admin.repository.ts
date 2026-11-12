import type {
  AdminAdoptionResponse,
  AdminResolvedRange,
  AdminSecurityResponse,
  AdminSuspendAccountResponse,
  AdminReliabilityResponse,
  AdminRetentionResponse,
  AdminUsageResponse,
} from '@monthloom/contracts';
import { and, count, countDistinct, eq, gt, gte, isNull, ne, sql } from 'drizzle-orm';

import { config } from '../../../config/index.js';
import type { Database } from '../../../infrastructure/database/client.js';
import {
  expenses,
  households,
  incomes,
  productEvents,
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
          WITH buckets AS (
            SELECT bucket_index,
              ${range.from}::date + bucket_index * ${range.bucket === 'day' ? 1 : 7} AS bucket_start,
              least(${range.to}::date, ${range.from}::date + (bucket_index + 1) * ${range.bucket === 'day' ? 1 : 7} - 1) AS bucket_end
            FROM generate_series(0, floor((${range.to}::date - ${range.from}::date) / ${range.bucket === 'day' ? 1 : 7})::int) AS bucket_index
          )
          SELECT b.bucket_index,
            count(DISTINCT e.actor_user_id) FILTER (WHERE e.event_name = 'user.active' AND u.role <> 'admin')::int AS active_users,
            (SELECT count(DISTINCT a.actor_user_id)::int FROM product_events a JOIN users au ON au.id = a.actor_user_id AND au.role <> 'admin'
              WHERE a.event_name = 'user.active' AND (a.occurred_at AT TIME ZONE ${range.timezone})::date = b.bucket_end) AS daily_active_users,
            (SELECT count(DISTINCT a.actor_user_id)::int FROM product_events a JOIN users au ON au.id = a.actor_user_id AND au.role <> 'admin'
              WHERE a.event_name = 'user.active' AND (a.occurred_at AT TIME ZONE ${range.timezone})::date BETWEEN b.bucket_end - 6 AND b.bucket_end) AS weekly_active_users,
            (SELECT count(DISTINCT a.actor_user_id)::int FROM product_events a JOIN users au ON au.id = a.actor_user_id AND au.role <> 'admin'
              WHERE a.event_name = 'user.active' AND (a.occurred_at AT TIME ZONE ${range.timezone})::date BETWEEN b.bucket_end - 29 AND b.bucket_end) AS monthly_active_users,
            count(DISTINCT e.household_id) FILTER (WHERE e.household_id IS NOT NULL)::int AS active_households,
            count(*) FILTER (WHERE e.event_name = 'transaction.created')::int AS transactions_created,
            count(*) FILTER (WHERE e.event_name = 'transaction.updated')::int AS transactions_updated,
            count(*) FILTER (WHERE e.event_name = 'transaction.deleted')::int AS transactions_deleted,
            count(*) FILTER (WHERE e.event_name = 'user.registered' AND u.role <> 'admin')::int AS registrations
          FROM buckets b LEFT JOIN product_events e ON (e.occurred_at AT TIME ZONE ${range.timezone})::date BETWEEN b.bucket_start AND b.bucket_end
          LEFT JOIN users u ON u.id = e.actor_user_id
          GROUP BY b.bucket_index, b.bucket_end ORDER BY b.bucket_index
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
              count(DISTINCT e.actor_user_id) FILTER (WHERE au.id IS NOT NULL AND (e.occurred_at AT TIME ZONE ${range.timezone})::date = d.day) AS dau,
              count(DISTINCT e.actor_user_id) FILTER (WHERE au.id IS NOT NULL) AS mau
            FROM days d LEFT JOIN product_events e ON e.event_name = 'user.active'
              AND (e.occurred_at AT TIME ZONE ${range.timezone})::date BETWEEN d.day - 29 AND d.day
              LEFT JOIN users au ON au.id = e.actor_user_id AND au.role <> 'admin'
            GROUP BY d.day
          ), cohort AS (
            SELECT r.actor_user_id, (r.occurred_at AT TIME ZONE ${range.timezone})::date AS registered_date
            FROM product_events r JOIN users ru ON ru.id = r.actor_user_id AND ru.role <> 'admin'
            WHERE r.event_name = 'user.registered'
              AND r.occurred_at >= ${new Date(range.start)} AND r.occurred_at < ${new Date(range.endExclusive)}
          )
          SELECT
            (SELECT avg(CASE WHEN mau > 0 THEN dau::numeric / mau * 100 END)::float8 FROM daily) AS stickiness,
            (SELECT count(*) FROM users WHERE role <> 'admin' AND created_at < ${new Date(range.endExclusive)})::int AS eligible_users,
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
          dailyActiveUsers: row?.daily_active_users ?? 0,
          weeklyActiveUsers: row?.weekly_active_users ?? 0,
          monthlyActiveUsers: row?.monthly_active_users ?? 0,
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

  async getAdoption(
    range: AdminResolvedRange,
    comparisonRange: AdminResolvedRange,
  ): Promise<Omit<AdminAdoptionResponse, 'generatedAt' | 'range' | 'comparisonRange'>> {
    const [
      currentRegistrations,
      previousRegistrations,
      seriesResult,
      noHouseholdResult,
      firstHouseholdResult,
      firstTransactionResult,
      invitationsResult,
    ] = await Promise.all([
      this.getRegistrationCount(range),
      this.getRegistrationCount(comparisonRange),
      this.db.execute<RegistrationSeriesRow>(sql`
          SELECT floor((((created_at AT TIME ZONE ${range.timezone})::date - ${range.from}::date) / ${range.bucket === 'day' ? 1 : 7}))::int AS bucket_index,
            count(*)::int AS registrations
          FROM users
          WHERE role <> 'admin' AND created_at >= ${new Date(range.start)} AND created_at < ${new Date(range.endExclusive)}
          GROUP BY bucket_index ORDER BY bucket_index
        `),
      this.db.execute<CountRow>(sql`
          SELECT count(*)::int AS count FROM users u
          WHERE u.role <> 'admin' AND u.created_at < ${new Date(range.endExclusive)}
            AND NOT EXISTS (
              SELECT 1 FROM household_members hm
              WHERE hm.user_id = u.id AND hm.joined_at < ${new Date(range.endExclusive)}
            )
        `),
      this.getFirstEventDistribution(range, 'household.joined'),
      this.getFirstEventDistribution(range, 'transaction.created'),
      this.db.execute<InvitationAdoptionRow>(sql`
          SELECT count(*)::int AS sent,
            count(*) FILTER (WHERE accepted_at IS NOT NULL AND accepted_at < ${new Date(range.endExclusive)})::int AS accepted,
            count(*) FILTER (WHERE accepted_at IS NULL AND expires_at < ${new Date(range.endExclusive)})::int AS expired,
            count(*) FILTER (WHERE accepted_at IS NULL AND expires_at >= ${new Date(range.endExclusive)})::int AS open
          FROM household_invitations
          WHERE created_at >= ${new Date(range.start)} AND created_at < ${new Date(range.endExclusive)}
        `),
    ]);

    const seriesRows = seriesResult.rows;
    const invitations = invitationsResult.rows[0] ?? { sent: 0, accepted: 0, expired: 0, open: 0 };
    return {
      registrations: compared(currentRegistrations, previousRegistrations),
      registrationSeries: adminCalendarBuckets(range).map((bucket, index) => ({
        ...bucket,
        registrations: seriesRows.find((row) => row.bucket_index === index)?.registrations ?? 0,
      })),
      usersWithoutHousehold: noHouseholdResult.rows[0]?.count ?? 0,
      timeToFirstHousehold: firstHouseholdResult,
      timeToFirstTransaction: firstTransactionResult,
      invitations: {
        ...invitations,
        conversionRate: invitations.sent ? (invitations.accepted / invitations.sent) * 100 : null,
      },
    };
  }

  async getRetention(
    range: AdminResolvedRange,
    _comparisonRange: AdminResolvedRange,
  ): Promise<Omit<AdminRetentionResponse, 'generatedAt' | 'range' | 'comparisonRange'>> {
    const [retentionResult, cohortResult, dormantResult, reactivationResult, coverageResult] =
      await Promise.all([
        this.db.execute<RetentionRow>(sql`
        WITH cohort AS (
          SELECT u.id, (u.created_at AT TIME ZONE ${range.timezone})::date AS joined
          FROM users u WHERE u.role <> 'admin'
            AND u.created_at >= ${new Date(range.start)} AND u.created_at < ${new Date(range.endExclusive)}
        ), days(day) AS (VALUES (1), (7), (30))
        SELECT day,
          count(*) FILTER (WHERE joined <= ${range.to}::date - day)::int AS eligible,
          count(*) FILTER (WHERE joined <= ${range.to}::date - day AND EXISTS (
            SELECT 1 FROM product_events e WHERE e.event_name = 'user.active' AND e.actor_user_id = cohort.id
              AND (e.occurred_at AT TIME ZONE ${range.timezone})::date = joined + day
          ))::int AS retained
        FROM cohort CROSS JOIN days GROUP BY day ORDER BY day
      `),
        this.db.execute<CohortRow>(sql`
        WITH cohorts AS (
          SELECT u.id, date_trunc('week', u.created_at AT TIME ZONE ${range.timezone})::date AS week
          FROM users u WHERE u.role <> 'admin'
            AND u.created_at >= ${new Date(range.start)} AND u.created_at < ${new Date(range.endExclusive)}
        ), weeks(week_offset) AS (SELECT generate_series(0, 7))
        SELECT c.week, w.week_offset, count(DISTINCT c.id)::int AS size,
          count(DISTINCT c.id) FILTER (WHERE EXISTS (
            SELECT 1 FROM product_events e WHERE e.event_name = 'user.active' AND e.actor_user_id = c.id
              AND (e.occurred_at AT TIME ZONE ${range.timezone})::date >= c.week + w.week_offset * 7
              AND (e.occurred_at AT TIME ZONE ${range.timezone})::date < c.week + (w.week_offset + 1) * 7
          ))::int AS retained
        FROM cohorts c CROSS JOIN weeks w GROUP BY c.week, w.week_offset ORDER BY c.week, w.week_offset
      `),
        this.db.execute<DormantRow>(sql`
        SELECT
          count(*) FILTER (WHERE last_active < ${new Date(new Date(range.endExclusive).getTime() - 30 * 86_400_000)})::int AS users_30,
          count(*) FILTER (WHERE last_active < ${new Date(new Date(range.endExclusive).getTime() - 90 * 86_400_000)})::int AS users_90,
          (SELECT count(*) FROM (
            SELECT household_id, max(occurred_at) AS last_active FROM product_events
            WHERE household_id IS NOT NULL AND occurred_at < ${new Date(range.endExclusive)} GROUP BY household_id
          ) active_households WHERE last_active < ${new Date(new Date(range.endExclusive).getTime() - 30 * 86_400_000)})::int AS households_30
        FROM (
          SELECT u.id, max(e.occurred_at) AS last_active FROM users u
          JOIN product_events e ON e.actor_user_id = u.id AND e.event_name = 'user.active'
          WHERE u.role <> 'admin' AND e.occurred_at < ${new Date(range.endExclusive)} GROUP BY u.id
        ) active_users
      `),
        this.db.execute<ReactivationRow>(sql`
        WITH candidates AS (
          SELECT e.actor_user_id, min(e.occurred_at) AS reactivated_at
          FROM product_events e JOIN users u ON u.id = e.actor_user_id AND u.role <> 'admin'
          WHERE e.event_name = 'user.active' AND e.occurred_at >= ${new Date(range.start)} AND e.occurred_at < ${new Date(range.endExclusive)}
            AND EXISTS (SELECT 1 FROM product_events old WHERE old.event_name = 'user.active' AND old.actor_user_id = e.actor_user_id
              AND old.occurred_at < e.occurred_at - interval '30 days')
            AND NOT EXISTS (SELECT 1 FROM product_events recent WHERE recent.event_name = 'user.active' AND recent.actor_user_id = e.actor_user_id
              AND recent.occurred_at >= e.occurred_at - interval '30 days' AND recent.occurred_at < e.occurred_at)
          GROUP BY e.actor_user_id
        )
        SELECT floor((((reactivated_at AT TIME ZONE ${range.timezone})::date - ${range.from}::date) / ${range.bucket === 'day' ? 1 : 7}))::int AS bucket_index,
          count(*)::int AS users FROM candidates GROUP BY bucket_index ORDER BY bucket_index
      `),
        this.db.execute<{ occurred_at: Date }>(
          sql`SELECT occurred_at FROM product_events WHERE event_name = 'analytics.collection_started' ORDER BY occurred_at LIMIT 1`,
        ),
      ]);
    const cohorts = new Map<string, { week: string; size: number; weeks: Array<number | null> }>();
    for (const row of cohortResult.rows) {
      const key = String(row.week);
      const item = cohorts.get(key) ?? { week: key, size: row.size, weeks: [] };
      const matured =
        new Date(`${key}T00:00:00Z`).getTime() + (row.week_offset + 1) * 7 * 86_400_000 <=
        new Date(range.endExclusive).getTime();
      item.weeks[row.week_offset] = matured ? percent(row.retained, row.size) : null;
      cohorts.set(key, item);
    }
    const dormant = dormantResult.rows[0];
    return {
      retention: ([1, 7, 30] as const).map((day) => {
        const row = retentionResult.rows.find((item) => item.day === day);
        return {
          day: `d${day}` as 'd1' | 'd7' | 'd30',
          retained: row?.retained ?? 0,
          eligible: row?.eligible ?? 0,
          rate: nullablePercent(row?.retained, row?.eligible),
        };
      }),
      cohorts: [...cohorts.values()],
      dormant: {
        users30Days: dormant?.users_30 ?? 0,
        users90Days: dormant?.users_90 ?? 0,
        households30Days: dormant?.households_30 ?? 0,
      },
      reactivations: adminCalendarBuckets(range).map((bucket, index) => ({
        ...bucket,
        users: reactivationResult.rows.find((row) => row.bucket_index === index)?.users ?? 0,
      })),
      coverageStartedAt: new Date(coverageResult.rows[0]?.occurred_at ?? Date.now()).toISOString(),
    };
  }

  async getReliability(
    range: AdminResolvedRange,
    comparisonRange: AdminResolvedRange,
  ): Promise<Omit<AdminReliabilityResponse, 'generatedAt' | 'range' | 'comparisonRange'>> {
    const [
      current,
      previous,
      seriesResult,
      routesResult,
      versionsResult,
      deploymentsResult,
      statusResult,
    ] = await Promise.all([
      this.getReliabilityTotals(range),
      this.getReliabilityTotals(comparisonRange),
      this.db.execute<ReliabilitySeriesRow>(sql`
        SELECT floor((((hour AT TIME ZONE ${range.timezone})::date - ${range.from}::date) / ${range.bucket === 'day' ? 1 : 7}))::int AS bucket_index,
          sum(request_count)::int AS requests, sum(request_count) FILTER (WHERE status_class = 5)::int AS errors,
          coalesce(sum(duration_total_ms)::float8 / nullif(sum(request_count), 0), 0) AS average_latency_ms
        FROM request_hourly_rollups WHERE hour >= ${new Date(range.start)} AND hour < ${new Date(range.endExclusive)} GROUP BY bucket_index ORDER BY bucket_index
      `),
      this.db.execute<SlowRouteRow>(sql`
        SELECT method, route, sum(request_count)::int AS requests,
          coalesce(sum(request_count) FILTER (WHERE status_class = 5)::float8 / nullif(sum(request_count), 0) * 100, 0) AS error_rate,
          coalesce(sum(duration_total_ms)::float8 / nullif(sum(request_count), 0), 0) AS average_latency_ms,
          max(duration_max_ms)::float8 AS max_latency_ms
        FROM request_hourly_rollups WHERE hour >= ${new Date(range.start)} AND hour < ${new Date(range.endExclusive)}
        GROUP BY method, route ORDER BY requests DESC, route LIMIT 50
      `),
      this.db.execute<{ version: string; requests: number }>(sql`
        SELECT client_version AS version, sum(request_count)::int AS requests FROM request_hourly_rollups
        WHERE hour >= ${new Date(range.start)} AND hour < ${new Date(range.endExclusive)} GROUP BY client_version ORDER BY requests DESC LIMIT 10
      `),
      this.db.execute<{ version: string; deployed_at: Date }>(sql`
        SELECT version, deployed_at FROM application_deployments
        WHERE deployed_at < ${new Date(range.endExclusive)} ORDER BY deployed_at
      `),
      this.db.execute<OperationalStatusRow>(sql`
          SELECT key, status, last_attempt_at, last_success_at, detail
          FROM operational_status
          WHERE key IN ('email.delivery', 'readiness.database', 'backup')
        `),
    ]);
    const unknown = (detail: string) => ({
      status: 'unknown' as const,
      lastObservedAt: null,
      detail,
    });
    const operational = (key: string, missing: string) => {
      const item = statusResult.rows.find((row) => row.key === key);
      return item
        ? {
            status: item.status,
            lastObservedAt: new Date(item.last_attempt_at).toISOString(),
            detail: item.detail,
          }
        : unknown(missing);
    };
    return {
      summary: {
        requests: compared(current.requests, previous.requests),
        errorRate: compared(current.errorRate, previous.errorRate),
        averageLatencyMs: compared(current.averageLatencyMs, previous.averageLatencyMs),
        p95LatencyMs: compared(current.p95LatencyMs, previous.p95LatencyMs),
        databaseAverageMs: compared(current.databaseAverageMs, previous.databaseAverageMs),
      },
      series: adminCalendarBuckets(range).map((bucket, index) => ({
        ...bucket,
        requests: seriesResult.rows.find((row) => row.bucket_index === index)?.requests ?? 0,
        errors: seriesResult.rows.find((row) => row.bucket_index === index)?.errors ?? 0,
        averageLatencyMs: Number(
          seriesResult.rows.find((row) => row.bucket_index === index)?.average_latency_ms ?? 0,
        ),
      })),
      slowRoutes: routesResult.rows.map((row) => ({
        method: row.method,
        route: row.route,
        requests: row.requests,
        errorRate: Number(row.error_rate),
        averageLatencyMs: Number(row.average_latency_ms),
        maxLatencyMs: Number(row.max_latency_ms),
      })),
      email: operational('email.delivery', 'No email delivery has been attempted.'),
      readiness: operational('readiness.database', 'No readiness probe has been recorded.'),
      backgroundJobs: {
        status: 'healthy',
        lastObservedAt: null,
        detail: 'No background jobs are configured.',
      },
      backups: operational('backup', 'No backup report has been received.'),
      deployment: {
        applicationVersion: config.deployment.version,
        deployedAt: config.deployment.deployedAt,
        history: deploymentsResult.rows.map((item) => ({
          version: item.version,
          deployedAt: new Date(item.deployed_at).toISOString(),
        })),
        clientVersions: versionsResult.rows,
      },
    };
  }

  async getSecurity(
    range: AdminResolvedRange,
    comparisonRange: AdminResolvedRange,
  ): Promise<Omit<AdminSecurityResponse, 'generatedAt' | 'range' | 'comparisonRange'>> {
    const [current, previous, seriesResult, routesResult, accountResult] = await Promise.all([
      this.getSecurityTotals(range),
      this.getSecurityTotals(comparisonRange),
      this.db.execute<SecuritySeriesRow>(sql`
        SELECT floor((((occurred_at AT TIME ZONE ${range.timezone})::date - ${range.from}::date)
          / ${range.bucket === 'day' ? 1 : 7}))::int AS bucket_index,
          count(*) FILTER (WHERE event_name = 'auth.login.succeeded')::int AS successful_logins,
          count(*) FILTER (WHERE event_name = 'auth.login.failed')::int AS failed_logins,
          count(*) FILTER (WHERE event_name = 'security.rate_limited')::int AS rate_limited_requests
        FROM product_events
        WHERE occurred_at >= ${new Date(range.start)} AND occurred_at < ${new Date(range.endExclusive)}
          AND event_name IN ('auth.login.succeeded', 'auth.login.failed', 'security.rate_limited')
        GROUP BY bucket_index ORDER BY bucket_index
      `),
      this.db.execute<RateLimitRouteRow>(sql`
        WITH client_windows AS (
          SELECT metadata->>'routeGroup' AS route, metadata->>'clientKey' AS client_key,
            floor(extract(epoch FROM occurred_at) / 900) AS limiter_window,
            count(*)::int AS requests
          FROM product_events
          WHERE event_name = 'security.rate_limited'
            AND occurred_at >= ${new Date(range.start)} AND occurred_at < ${new Date(range.endExclusive)}
          GROUP BY route, client_key, limiter_window
        ), clients AS (
          SELECT route, client_key, sum(requests)::int AS requests,
            bool_or(requests >= 3) AS repeated
          FROM client_windows GROUP BY route, client_key
        )
        SELECT coalesce(route, 'unknown') AS route, sum(requests)::int AS requests,
          count(*)::int AS affected_clients,
          count(*) FILTER (WHERE repeated)::int AS repeated_clients
        FROM clients GROUP BY route ORDER BY requests DESC, route
      `),
      this.db.execute<AccountStateRow>(sql`
        SELECT count(*) FILTER (WHERE NOT email_verified)::int AS unverified,
          count(*) FILTER (WHERE locked_until > ${new Date(range.endExclusive)})::int AS locked,
          count(*) FILTER (WHERE suspended_at IS NOT NULL AND suspended_at < ${new Date(range.endExclusive)})::int AS suspended
        FROM users WHERE role <> 'admin'
      `),
    ]);
    const accounts = accountResult.rows[0] ?? { unverified: 0, locked: 0, suspended: 0 };
    return {
      summary: {
        failedLogins: compared(current.failed_logins, previous.failed_logins),
        loginFailureRate: compared(current.failure_rate, previous.failure_rate),
        rateLimitedRequests: compared(
          current.rate_limited_requests,
          previous.rate_limited_requests,
        ),
        affectedClients: compared(current.affected_clients, previous.affected_clients),
      },
      accountState: accounts,
      series: adminCalendarBuckets(range).map((bucket, index) => {
        const row = seriesResult.rows.find((item) => item.bucket_index === index);
        return {
          ...bucket,
          successfulLogins: row?.successful_logins ?? 0,
          failedLogins: row?.failed_logins ?? 0,
          rateLimitedRequests: row?.rate_limited_requests ?? 0,
        };
      }),
      rateLimitRoutes: routesResult.rows.map((row) => ({
        route: row.route,
        requests: row.requests,
        affectedClients: row.affected_clients,
        repeatedClients: row.repeated_clients,
      })),
    };
  }

  async suspendAccount(
    userId: string,
    administratorId: string,
    now: Date,
  ): Promise<AdminSuspendAccountResponse | null> {
    return this.db.transaction(async (tx) => {
      const [account] = await tx
        .update(users)
        .set({ suspendedAt: now, updatedAt: now })
        .where(and(eq(users.id, userId), ne(users.role, 'admin'), isNull(users.suspendedAt)))
        .returning({ userId: users.id, suspendedAt: users.suspendedAt });
      if (!account?.suspendedAt) return null;
      await tx
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
      await tx.insert(productEvents).values({
        eventName: 'account.suspended',
        occurredAt: now,
        actorUserId: administratorId,
        subjectId: userId,
        subjectKind: 'user',
        metadata: {},
      });
      return { userId: account.userId, suspendedAt: account.suspendedAt.toISOString() };
    });
  }

  private async getSecurityTotals(range: AdminResolvedRange): Promise<SecurityTotalsRow> {
    const result = await this.db.execute<SecurityTotalsRow>(sql`
      SELECT count(*) FILTER (WHERE event_name = 'auth.login.failed')::int AS failed_logins,
        coalesce(count(*) FILTER (WHERE event_name = 'auth.login.failed')::float8 /
          nullif(count(*) FILTER (WHERE event_name IN ('auth.login.failed', 'auth.login.succeeded')), 0) * 100, 0) AS failure_rate,
        count(*) FILTER (WHERE event_name = 'security.rate_limited')::int AS rate_limited_requests,
        count(DISTINCT metadata->>'clientKey') FILTER (WHERE event_name = 'security.rate_limited')::int AS affected_clients
      FROM product_events WHERE occurred_at >= ${new Date(range.start)} AND occurred_at < ${new Date(range.endExclusive)}
    `);
    return (
      result.rows[0] ?? {
        failed_logins: 0,
        failure_rate: 0,
        rate_limited_requests: 0,
        affected_clients: 0,
      }
    );
  }

  private async getReliabilityTotals(range: AdminResolvedRange): Promise<ReliabilityTotals> {
    const result = await this.db.execute<ReliabilityTotals>(sql`
      SELECT coalesce(sum(request_count), 0)::int AS requests,
        coalesce(sum(request_count) FILTER (WHERE status_class = 5)::float8 / nullif(sum(request_count), 0) * 100, 0) AS "errorRate",
        coalesce(sum(duration_total_ms)::float8 / nullif(sum(request_count), 0), 0) AS "averageLatencyMs",
        CASE
          WHEN coalesce(sum(request_count), 0) = 0 THEN 0
          WHEN sum(duration_le_10_ms) >= ceil(sum(request_count) * .95) THEN 10
          WHEN sum(duration_le_50_ms) >= ceil(sum(request_count) * .95) THEN 50
          WHEN sum(duration_le_100_ms) >= ceil(sum(request_count) * .95) THEN 100
          WHEN sum(duration_le_250_ms) >= ceil(sum(request_count) * .95) THEN 250
          WHEN sum(duration_le_500_ms) >= ceil(sum(request_count) * .95) THEN 500
          WHEN sum(duration_le_1000_ms) >= ceil(sum(request_count) * .95) THEN 1000
          ELSE coalesce(max(duration_max_ms), 0)
        END::float8 AS "p95LatencyMs",
        coalesce((
          SELECT avg((metadata->>'durationMs')::float8)
          FROM product_events
          WHERE event_name = 'readiness.database.checked'
            AND occurred_at >= ${new Date(range.start)}
            AND occurred_at < ${new Date(range.endExclusive)}
        ), 0) AS "databaseAverageMs"
      FROM request_hourly_rollups WHERE hour >= ${new Date(range.start)} AND hour < ${new Date(range.endExclusive)}
    `);
    const row = result.rows[0];
    return {
      requests: row?.requests ?? 0,
      errorRate: Number(row?.errorRate ?? 0),
      averageLatencyMs: Number(row?.averageLatencyMs ?? 0),
      p95LatencyMs: Number(row?.p95LatencyMs ?? 0),
      databaseAverageMs: Number(row?.databaseAverageMs ?? 0),
    };
  }

  private async getRegistrationCount(range: AdminResolvedRange): Promise<number> {
    const result = await this.db.execute<CountRow>(sql`
      SELECT count(*)::int AS count FROM users
      WHERE role <> 'admin' AND created_at >= ${new Date(range.start)} AND created_at < ${new Date(range.endExclusive)}
    `);
    return result.rows[0]?.count ?? 0;
  }

  private async getFirstEventDistribution(
    range: AdminResolvedRange,
    eventName: 'household.joined' | 'transaction.created',
  ): Promise<AdminAdoptionResponse['timeToFirstHousehold']> {
    const result = await this.db.execute<DurationDistributionRow>(sql`
      WITH cohort AS (
        SELECT id, created_at FROM users
        WHERE role <> 'admin' AND created_at >= ${new Date(range.start)} AND created_at < ${new Date(range.endExclusive)}
      ), first_events AS (
        SELECT c.id, c.created_at, min(e.occurred_at) AS first_at
        FROM cohort c LEFT JOIN product_events e ON e.actor_user_id = c.id
          AND e.event_name = ${eventName} AND e.occurred_at >= c.created_at
        GROUP BY c.id, c.created_at
      )
      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (first_at - created_at)) / 3600)::float8 AS median_hours,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY extract(epoch FROM (first_at - created_at)) / 3600)::float8 AS p75_hours,
        count(*) FILTER (WHERE first_at IS NOT NULL)::int AS converted,
        count(*) FILTER (WHERE first_at IS NULL)::int AS not_converted
      FROM first_events
    `);
    const row = result.rows[0];
    return {
      medianHours: nullableNumber(row?.median_hours),
      p75Hours: nullableNumber(row?.p75_hours),
      converted: row?.converted ?? 0,
      notConverted: row?.not_converted ?? 0,
    };
  }

  private async getUsageTotals(range: AdminResolvedRange): Promise<UsageTotals> {
    const result = await this.db.execute<UsageTotals>(sql`
      SELECT
        count(DISTINCT e.actor_user_id) FILTER (WHERE e.event_name = 'user.active' AND u.role <> 'admin')::int AS "activeUsers",
        count(*) FILTER (WHERE e.event_name = 'user.registered' AND u.role <> 'admin')::int AS "newUsers",
        count(DISTINCT e.household_id) FILTER (WHERE e.household_id IS NOT NULL)::int AS "activeHouseholds",
        count(*) FILTER (WHERE e.event_name = 'transaction.created')::int AS "transactionsCreated",
        count(*) FILTER (WHERE e.event_name = 'transaction.created' AND e.subject_kind = 'income')::int AS incomes,
        count(*) FILTER (WHERE e.event_name = 'transaction.created' AND e.subject_kind = 'expense')::int AS expenses
      FROM product_events e LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.occurred_at >= ${new Date(range.start)} AND e.occurred_at < ${new Date(range.endExclusive)}
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
  daily_active_users: number;
  weekly_active_users: number;
  monthly_active_users: number;
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
interface RegistrationSeriesRow extends Record<string, unknown> {
  bucket_index: number;
  registrations: number;
}
interface CountRow extends Record<string, unknown> {
  count: number;
}
interface DurationDistributionRow extends Record<string, unknown> {
  median_hours: number | null;
  p75_hours: number | null;
  converted: number;
  not_converted: number;
}
interface InvitationAdoptionRow extends Record<string, unknown> {
  sent: number;
  accepted: number;
  expired: number;
  open: number;
}
interface RetentionRow extends Record<string, unknown> {
  day: 1 | 7 | 30;
  eligible: number;
  retained: number;
}
interface CohortRow extends Record<string, unknown> {
  week: string;
  week_offset: number;
  size: number;
  retained: number;
}
interface DormantRow extends Record<string, unknown> {
  users_30: number;
  users_90: number;
  households_30: number;
}
interface ReactivationRow extends Record<string, unknown> {
  bucket_index: number;
  users: number;
}
interface ReliabilityTotals extends Record<string, unknown> {
  requests: number;
  errorRate: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  databaseAverageMs: number;
}
interface ReliabilitySeriesRow extends Record<string, unknown> {
  bucket_index: number;
  requests: number;
  errors: number;
  average_latency_ms: number;
}
interface SlowRouteRow extends Record<string, unknown> {
  method: string;
  route: string;
  requests: number;
  error_rate: number;
  average_latency_ms: number;
  max_latency_ms: number;
}
interface SecurityTotalsRow extends Record<string, unknown> {
  failed_logins: number;
  failure_rate: number;
  rate_limited_requests: number;
  affected_clients: number;
}
interface SecuritySeriesRow extends Record<string, unknown> {
  bucket_index: number;
  successful_logins: number;
  failed_logins: number;
  rate_limited_requests: number;
}
interface RateLimitRouteRow extends Record<string, unknown> {
  route: string;
  requests: number;
  affected_clients: number;
  repeated_clients: number;
}
interface AccountStateRow extends Record<string, unknown> {
  unverified: number;
  locked: number;
  suspended: number;
}
interface OperationalStatusRow extends Record<string, unknown> {
  key: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  last_attempt_at: Date;
  last_success_at: Date | null;
  detail: string;
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

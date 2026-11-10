import {
  adminAdoptionResponseSchema,
  adminHealthResponseSchema,
  adminOverviewResponseSchema,
  adminReliabilityResponseSchema,
  adminSecurityResponseSchema,
  adminRetentionResponseSchema,
  adminUsageResponseSchema,
  type AdminDashboardResponse,
  type AdminAdoptionResponse,
  type AdminHealthResponse,
  type AdminLogEntry,
  type AdminOverviewResponse,
  type AdminReliabilityResponse,
  type AdminSecurityResponse,
  type AdminRetentionResponse,
  type AdminUsageResponse,
} from '@monthloom/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import React from 'react';

import { apiClient } from '../../../lib/api/client';
import { getServerUser } from '../../../lib/auth/get-server-user';

import './admin.css';
import { AdoptionTrendChart } from './adoption-trend-chart';
import { HealthEventTable } from './health-event-table';
import { ReliabilityTables } from './reliability-tables';
import { UsageChart } from './usage-chart';

type AdminView =
  | 'overview'
  | 'health'
  | 'usage'
  | 'adoption'
  | 'retention'
  | 'reliability'
  | 'security';

type AdminSearchParams = {
  view?: string;
  from?: string;
  to?: string;
  timezone?: string;
  bucket?: string;
};

export default async function AdminPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const user = await getServerUser();
  if (!user || user.role !== 'admin') redirect('/');

  const view: AdminView = ['health', 'usage', 'adoption', 'retention', 'reliability', 'security'].includes(
    searchParams.view ?? '',
  )
    ? (searchParams.view as AdminView)
    : 'overview';
  const cookieHeader = cookies().toString();
  const [overviewResponse, healthResponse] = await Promise.all([
    apiClient.get<AdminOverviewResponse>('admin/overview', { cookieHeader }),
    apiClient.get<AdminHealthResponse>('admin/health', { cookieHeader }),
  ]);
  const overview = adminOverviewResponseSchema.parse(overviewResponse);
  const health = adminHealthResponseSchema.parse(healthResponse);
  const data: AdminDashboardResponse = { ...overview, health: health.health };
  const usageQuery = {
    from: searchParams.from,
    to: searchParams.to,
    timezone: searchParams.timezone ?? 'UTC',
    bucket: searchParams.bucket,
  };
  const usage =
    view === 'usage'
      ? adminUsageResponseSchema.parse(
          await apiClient.get<AdminUsageResponse>('admin/usage', {
            cookieHeader,
            query: usageQuery,
          }),
        )
      : null;
  const adoption =
    view === 'adoption'
      ? adminAdoptionResponseSchema.parse(
          await apiClient.get<AdminAdoptionResponse>('admin/adoption', {
            cookieHeader,
            query: usageQuery,
          }),
        )
      : null;
  const retention =
    view === 'retention'
      ? adminRetentionResponseSchema.parse(
          await apiClient.get<AdminRetentionResponse>('admin/retention', {
            cookieHeader,
            query: usageQuery,
          }),
        )
      : null;
  const reliability =
    view === 'reliability'
      ? adminReliabilityResponseSchema.parse(
          await apiClient.get<AdminReliabilityResponse>('admin/reliability', {
            cookieHeader,
            query: usageQuery,
          }),
        )
      : null;
  const security =
    view === 'security'
      ? adminSecurityResponseSchema.parse(
          await apiClient.get<AdminSecurityResponse>('admin/security', {
            cookieHeader,
            query: usageQuery,
          }),
        )
      : null;
  const t = await getTranslations('Admin');
  const numbers = new Intl.NumberFormat(user.locale);
  const dates = new Intl.DateTimeFormat(user.locale, { dateStyle: 'medium', timeStyle: 'short' });
  const statusLabel = {
    healthy: t('statusHealthy'),
    degraded: t('statusDegraded'),
    critical: t('statusCritical'),
    unavailable: t('statusUnavailable'),
  }[data.health.status];

  const tabs: Array<{ view: AdminView; label: string }> = [
    { view: 'overview', label: t('overview') },
    { view: 'health', label: t('health') },
    { view: 'usage', label: t('usage') },
    { view: 'adoption', label: t('adoption') },
    { view: 'retention', label: t('retention') },
    { view: 'reliability', label: t('reliability') },
    { view: 'security', label: t('security') },
  ];
  const preservedQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(usageQuery)) if (value) preservedQuery.set(key, value);

  return (
    <div className="adminPage">
      <header className="adminTitleRow">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('description')}</p>
        </div>
        <div className="adminFreshness">
          <span>{t('updated', { time: dates.format(new Date(data.generatedAt)) })}</span>
          <a className="adminRefresh" href={`/admin?view=${view}`}>
            {t('refresh')}
          </a>
        </div>
      </header>

      <nav className="adminTabs" aria-label={t('title')}>
        {tabs.map((tab) => (
          <Link
            key={tab.view}
            href={`/admin?view=${tab.view}${preservedQuery.size ? `&${preservedQuery}` : ''}`}
            aria-current={view === tab.view ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {view === 'overview' ? (
        <Overview data={data} numbers={numbers} dates={dates} statusLabel={statusLabel} />
      ) : null}
      {view === 'health' ? <Health data={data} dates={dates} statusLabel={statusLabel} /> : null}
      {view === 'usage' && usage ? <Usage data={usage} numbers={numbers} /> : null}
      {view === 'adoption' && adoption ? <Adoption data={adoption} numbers={numbers} /> : null}
      {view === 'retention' && retention ? <Retention data={retention} numbers={numbers} /> : null}
      {view === 'reliability' && reliability ? (
        <Reliability data={reliability} numbers={numbers} />
      ) : null}
      {view === 'security' && security ? <Security data={security} numbers={numbers} /> : null}
    </div>
  );
}

async function Security({
  data,
  numbers,
}: {
  data: AdminSecurityResponse;
  numbers: Intl.NumberFormat;
}) {
  const t = await getTranslations('Admin');
  const metrics = [
    [t('failedLogins'), data.summary.failedLogins.current],
    [t('loginFailureRate'), `${data.summary.loginFailureRate.current.toFixed(1)}%`],
    [t('rateLimitedRequests'), data.summary.rateLimitedRequests.current],
    [t('affectedClients'), data.summary.affectedClients.current],
  ] as const;
  return (
    <div className="adminView">
      <AnalyticsRange view="security" range={data.range} />
      <section className="adminPanel" aria-labelledby="security-summary">
        <div className="adminPanelHeader"><h2 id="security-summary">{t('securitySummary')}</h2></div>
        <div className="adminMetricGrid">
          {metrics.map(([label, value]) => <article className="adminMetric" key={label}><span>{label}</span><strong>{typeof value === 'number' ? numbers.format(value) : value}</strong></article>)}
        </div>
      </section>
      <section className="adminPanel" aria-labelledby="account-state">
        <div className="adminPanelHeader"><h2 id="account-state">{t('accountState')}</h2></div>
        <div className="adminMetricGrid">
          <article className="adminMetric"><span>{t('unverifiedAccounts')}</span><strong>{numbers.format(data.accountState.unverified)}</strong></article>
          <article className="adminMetric"><span>{t('lockedAccounts')}</span><strong>{numbers.format(data.accountState.locked)}</strong></article>
          <article className="adminMetric"><span>{t('suspendedAccounts')}</span><strong>{numbers.format(data.accountState.suspended)}</strong></article>
        </div>
      </section>
      <section className="adminPanel" aria-labelledby="security-trend">
        <div className="adminPanelHeader"><h2 id="security-trend">{t('securityTrend')}</h2></div>
        <div className="adminTableScroll"><table><thead><tr><th>{t('date')}</th><th>{t('successfulLogins')}</th><th>{t('failedLogins')}</th><th>{t('rateLimitedRequests')}</th></tr></thead><tbody>{data.series.map((row) => <tr key={row.from}><td>{row.from}</td><td>{numbers.format(row.successfulLogins)}</td><td>{numbers.format(row.failedLogins)}</td><td>{numbers.format(row.rateLimitedRequests)}</td></tr>)}</tbody></table></div>
      </section>
      <section className="adminPanel" aria-labelledby="rate-limit-routes">
        <div className="adminPanelHeader"><h2 id="rate-limit-routes">{t('rateLimitRoutes')}</h2></div>
        <div className="adminTableScroll"><table><thead><tr><th>{t('route')}</th><th>{t('requests')}</th><th>{t('affectedClients')}</th><th>{t('repeatedClients')}</th></tr></thead><tbody>{data.rateLimitRoutes.map((row) => <tr key={row.route}><td>{row.route}</td><td>{numbers.format(row.requests)}</td><td>{numbers.format(row.affectedClients)}</td><td>{numbers.format(row.repeatedClients)}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

async function Retention({
  data,
  numbers,
}: {
  data: AdminRetentionResponse;
  numbers: Intl.NumberFormat;
}) {
  const t = await getTranslations('Admin');
  const decimal = new Intl.NumberFormat(numbers.resolvedOptions().locale, {
    maximumFractionDigits: 1,
  });
  return (
    <div className="adminView">
      <AnalyticsRange view="retention" range={data.range} />
      <section className="adminPanel" aria-labelledby="retention-summary">
        <div className="adminSectionHeading">
          <h2 id="retention-summary">{t('retentionSummary')}</h2>
        </div>
        <div className="adminMetricStrip">
          {data.retention.map((metric) => (
            <div className="adminMetric" key={metric.day}>
              <span>{metric.day.toUpperCase()}</span>
              <strong>{metric.rate == null ? '—' : `${decimal.format(metric.rate)}%`}</strong>
              <small>
                {t('retainedUsers', { retained: metric.retained, eligible: metric.eligible })}
              </small>
            </div>
          ))}
        </div>
        <p className="adminCoverage">
          {t('coverageStarted', { date: data.coverageStartedAt.slice(0, 10) })}
        </p>
      </section>
      <section className="adminPanel" aria-labelledby="cohort-matrix">
        <div className="adminSectionHeading">
          <h2 id="cohort-matrix">{t('weeklyCohorts')}</h2>
        </div>
        <div className="adminTableWrap adminScrollBox">
          <table className="adminDataTable">
            <thead>
              <tr>
                <th>{t('cohort')}</th>
                <th>{t('users')}</th>
                {Array.from({ length: 8 }, (_, i) => (
                  <th key={i}>W{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((cohort) => (
                <tr key={cohort.week}>
                  <td>{cohort.week}</td>
                  <td>{cohort.size}</td>
                  {cohort.weeks.map((rate, i) => (
                    <td
                      key={i}
                      className="adminCohortCell"
                      style={
                        rate == null
                          ? undefined
                          : ({ '--cohort-strength': rate / 100 } as React.CSSProperties)
                      }
                    >
                      {rate == null ? '—' : `${decimal.format(rate)}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="adminPanel" aria-labelledby="dormancy">
        <div className="adminSectionHeading">
          <h2 id="dormancy">{t('dormancy')}</h2>
        </div>
        <div className="adminMetricStrip">
          {[
            [t('dormantUsers30'), data.dormant.users30Days],
            [t('dormantUsers90'), data.dormant.users90Days],
            [t('dormantHouseholds30'), data.dormant.households30Days],
            [
              t('reactivatedUsers'),
              data.reactivations.reduce((sum, point) => sum + point.users, 0),
            ],
          ].map(([label, value]) => (
            <div className="adminMetric" key={label}>
              <span>{label}</span>
              <strong>{numbers.format(value as number)}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="adminPanel" aria-labelledby="reactivation-trend">
        <div className="adminSectionHeading">
          <h2 id="reactivation-trend">{t('reactivatedUsers')}</h2>
        </div>
        <div className="adminTableWrap adminScrollBox">
          <table className="adminDataTable">
            <thead>
              <tr>
                <th>{t('period')}</th>
                <th>{t('users')}</th>
              </tr>
            </thead>
            <tbody>
              {data.reactivations.map((point) => (
                <tr key={point.from}>
                  <td>{point.from === point.to ? point.from : `${point.from} – ${point.to}`}</td>
                  <td>{numbers.format(point.users)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

async function Reliability({
  data,
  numbers,
}: {
  data: AdminReliabilityResponse;
  numbers: Intl.NumberFormat;
}) {
  const t = await getTranslations('Admin');
  const decimal = new Intl.NumberFormat(numbers.resolvedOptions().locale, {
    maximumFractionDigits: 1,
  });
  const metrics = [
    [t('requests'), data.summary.requests.current],
    [t('errorRate'), `${decimal.format(data.summary.errorRate.current)}%`],
    [t('averageLatency'), `${decimal.format(data.summary.averageLatencyMs.current)} ms`],
    [t('maximumLatency'), `${decimal.format(data.summary.p95LatencyMs.current)} ms`],
  ] as const;
  return (
    <div className="adminView">
      <AnalyticsRange view="reliability" range={data.range} />
      <section className="adminPanel" aria-labelledby="reliability-summary">
        <div className="adminSectionHeading">
          <h2 id="reliability-summary">{t('reliabilitySummary')}</h2>
        </div>
        <div className="adminMetricStrip">
          {metrics.map(([label, value]) => (
            <div className="adminMetric" key={label}>
              <span>{label}</span>
              <strong>{typeof value === 'number' ? numbers.format(value) : value}</strong>
            </div>
          ))}
        </div>
      </section>
      <ReliabilityTables
        data={data}
        locale={numbers.resolvedOptions().locale}
        labels={{
          routes: t('slowRoutes'),
          requests: t('requests'),
          errorRate: t('errorRate'),
          averageLatency: t('averageLatency'),
          maximumLatency: t('maximumLatency'),
          period: t('period'),
          errors: t('error'),
          empty: t('noReliabilityData'),
        }}
      />
      <section className="adminPanel" aria-labelledby="operations">
        <div className="adminSectionHeading">
          <h2 id="operations">{t('operationalSignals')}</h2>
        </div>
        <div className="adminSignalList">
          {[
            [t('emailDelivery'), data.email],
            [t('readiness'), data.readiness],
            [t('backgroundJobs'), data.backgroundJobs],
            [t('backups'), data.backups],
          ].map(([label, signal]) => (
            <div key={label as string}>
              <strong>{label as string}</strong>
              <span>{(signal as AdminReliabilityResponse['email']).status}</span>
              <small>{(signal as AdminReliabilityResponse['email']).detail}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AnalyticsRange({
  view,
  range,
}: {
  view: 'retention' | 'reliability' | 'security';
  range: AdminRetentionResponse['range'];
}) {
  return (
    <section className="adminPanel">
      <form className="adminRangeForm" method="get">
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="timezone" value={range.timezone} />
        <label>
          From
          <input type="date" name="from" defaultValue={range.from} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={range.to} />
        </label>
        <button type="submit">Apply range</button>
      </form>
    </section>
  );
}

async function Adoption({
  data,
  numbers,
}: {
  data: AdminAdoptionResponse;
  numbers: Intl.NumberFormat;
}) {
  const t = await getTranslations('Admin');
  const decimal = new Intl.NumberFormat(numbers.resolvedOptions().locale, {
    maximumFractionDigits: 1,
  });
  const distributions = [
    [t('firstHousehold'), data.timeToFirstHousehold],
    [t('firstTransaction'), data.timeToFirstTransaction],
  ] as const;

  return (
    <div className="adminView">
      <section className="adminPanel">
        <nav className="adminRangePresets" aria-label={t('rangePresets')}>
          <a href={`/admin?view=adoption&timezone=${encodeURIComponent(data.range.timezone)}`}>
            {t('currentMonth')}
          </a>
          {[7, 30, 90].map((days) => (
            <a
              key={days}
              href={`/admin?view=adoption&timezone=${encodeURIComponent(data.range.timezone)}&from=${shiftDate(data.range.to, -(days - 1))}&to=${data.range.to}`}
            >
              {t('lastDays', { days })}
            </a>
          ))}
        </nav>
        <form className="adminRangeForm" method="get">
          <input type="hidden" name="view" value="adoption" />
          <input type="hidden" name="timezone" value={data.range.timezone} />
          <label>
            {t('from')}
            <input type="date" name="from" defaultValue={data.range.from} />
          </label>
          <label>
            {t('to')}
            <input type="date" name="to" defaultValue={data.range.to} />
          </label>
          <button type="submit">{t('applyRange')}</button>
        </form>
      </section>

      <section className="adminPanel" aria-labelledby="adoption-summary">
        <div className="adminSectionHeading">
          <h2 id="adoption-summary">{t('adoptionSummary')}</h2>
        </div>
        <div className="adminMetricStrip">
          <div className="adminMetric">
            <span>{t('newUsers')}</span>
            <strong>{numbers.format(data.registrations.current)}</strong>
            <small>
              {data.registrations.changePercent == null
                ? t('noComparison')
                : t('periodChange', { value: decimal.format(data.registrations.changePercent) })}
            </small>
          </div>
          <div className="adminMetric">
            <span>{t('withoutHousehold')}</span>
            <strong>{numbers.format(data.usersWithoutHousehold)}</strong>
          </div>
        </div>
      </section>

      <section className="adminPanel" aria-labelledby="registration-trend">
        <div className="adminSectionHeading">
          <h2 id="registration-trend">{t('registrationTrend')}</h2>
        </div>
        <AdoptionTrendChart data={data.registrationSeries} registrationsLabel={t('newUsers')} />
      </section>

      <section className="adminPanel" aria-labelledby="onboarding-time">
        <div className="adminSectionHeading">
          <h2 id="onboarding-time">{t('onboardingTime')}</h2>
        </div>
        <div className="adminTableWrap">
          <table className="adminDataTable">
            <thead>
              <tr>
                <th>{t('milestone')}</th>
                <th>{t('medianHours')}</th>
                <th>{t('p75Hours')}</th>
                <th>{t('converted')}</th>
                <th>{t('notConverted')}</th>
              </tr>
            </thead>
            <tbody>
              {distributions.map(([label, item]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{item.medianHours == null ? '—' : decimal.format(item.medianHours)}</td>
                  <td>{item.p75Hours == null ? '—' : decimal.format(item.p75Hours)}</td>
                  <td>{numbers.format(item.converted)}</td>
                  <td>{numbers.format(item.notConverted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="adminPanel" aria-labelledby="invitation-conversion">
        <div className="adminSectionHeading">
          <h2 id="invitation-conversion">{t('invitationConversion')}</h2>
        </div>
        <div className="adminMetricStrip">
          {(
            [
              [t('sent'), data.invitations.sent],
              [t('accepted'), data.invitations.accepted],
              [t('expired'), data.invitations.expired],
              [t('open'), data.invitations.open],
            ] as const
          ).map(([label, value]) => (
            <div className="adminMetric" key={label}>
              <span>{label}</span>
              <strong>{numbers.format(value)}</strong>
            </div>
          ))}
        </div>
        <p className="adminCoverage">
          {t('conversionRate', {
            value:
              data.invitations.conversionRate == null
                ? '—'
                : decimal.format(data.invitations.conversionRate),
          })}
        </p>
      </section>
    </div>
  );
}

async function Overview({
  data,
  numbers,
  dates,
  statusLabel,
}: {
  data: AdminDashboardResponse;
  numbers: Intl.NumberFormat;
  dates: Intl.DateTimeFormat;
  statusLabel: string;
}) {
  const t = await getTranslations('Admin');
  const metrics = [
    [t('totalUsers'), data.metrics.totalUsers],
    [t('dailyActiveUsers'), data.metrics.dailyActiveUsers],
    [t('currentlyLoggedInUsers'), data.metrics.currentlyLoggedInUsers],
    [t('transactions'), data.metrics.transactions],
  ] as const;

  return (
    <div className="adminView">
      <section className="adminPanel" aria-labelledby="overview-status">
        <div className="adminSectionHeading">
          <h2 id="overview-status">{t('status')}</h2>
          <span className="adminStatus" data-status={data.health.status}>
            <span aria-hidden="true" />
            {statusLabel}
          </span>
        </div>
        <div className="adminMetricStrip">
          {metrics.map(([label, value]) => (
            <div key={label} className="adminMetric">
              <span>{label}</span>
              <strong>{numbers.format(value)}</strong>
            </div>
          ))}
        </div>
      </section>

      <SeverityLedger data={data} />

      <LogTable entries={data.health.entries.slice(0, 5)} dates={dates} title={t('recentEvents')} />
    </div>
  );
}

async function Health({
  data,
  dates,
  statusLabel,
}: {
  data: AdminDashboardResponse;
  dates: Intl.DateTimeFormat;
  statusLabel: string;
}) {
  const t = await getTranslations('Admin');
  return (
    <div className="adminView">
      <section className="adminPanel" aria-labelledby="health-status">
        <div className="adminSectionHeading">
          <div>
            <h2 id="health-status">{t('health')}</h2>
            <p>{t('logWindow', { days: data.health.windowDays })}</p>
          </div>
          <span className="adminStatus" data-status={data.health.status}>
            <span aria-hidden="true" />
            {statusLabel}
          </span>
        </div>
      </section>
      <SeverityLedger data={data} />
      <LogTable entries={data.health.entries} dates={dates} title={t('allEvents')} />
    </div>
  );
}

async function Usage({ data, numbers }: { data: AdminUsageResponse; numbers: Intl.NumberFormat }) {
  const t = await getTranslations('Admin');
  const metrics = [
    [t('activeUsers'), data.summary.activeUsers],
    [t('newUsers'), data.summary.newUsers],
    [t('activeHouseholds'), data.summary.activeHouseholds],
    [t('transactionsCreated'), data.summary.transactionsCreated],
    [t('transactionsPerHousehold'), data.summary.transactionsPerActiveHousehold],
  ] as const;
  const percent = new Intl.NumberFormat(numbers.resolvedOptions().locale, {
    maximumFractionDigits: 1,
  });

  return (
    <div className="adminView">
      <section className="adminPanel">
        <nav className="adminRangePresets" aria-label={t('rangePresets')}>
          <a href={`/admin?view=usage&timezone=${encodeURIComponent(data.range.timezone)}`}>
            {t('currentMonth')}
          </a>
          {[7, 30, 90].map((days) => (
            <a
              key={days}
              href={`/admin?view=usage&timezone=${encodeURIComponent(data.range.timezone)}&from=${shiftDate(data.range.to, -(days - 1))}&to=${data.range.to}`}
            >
              {t('lastDays', { days })}
            </a>
          ))}
        </nav>
        <form className="adminRangeForm" method="get">
          <input type="hidden" name="view" value="usage" />
          <input type="hidden" name="timezone" value={data.range.timezone} />
          <label>
            {t('from')}
            <input type="date" name="from" defaultValue={data.range.from} />
          </label>
          <label>
            {t('to')}
            <input type="date" name="to" defaultValue={data.range.to} />
          </label>
          <button type="submit">{t('applyRange')}</button>
        </form>
        <p className="adminCoverage">
          {t('coverageStarted', { date: data.coverageStartedAt.slice(0, 10) })}
        </p>
      </section>
      <section className="adminPanel" aria-labelledby="usage-summary">
        <div className="adminSectionHeading">
          <h2 id="usage-summary">{t('usageSummary')}</h2>
        </div>
        <div className="adminMetricStrip">
          {metrics.map(([label, metric]) => (
            <div key={label} className="adminMetric">
              <span>{label}</span>
              <strong>{numbers.format(metric.current)}</strong>
              <small>
                {metric.changePercent == null
                  ? t('noComparison')
                  : t('periodChange', { value: percent.format(metric.changePercent) })}
              </small>
            </div>
          ))}
        </div>
      </section>

      <section className="adminPanel" aria-labelledby="daily-usage">
        <div className="adminSectionHeading">
          <h2 id="daily-usage">{t('dailyUsage')}</h2>
        </div>
        <UsageChart
          data={data.series}
          title={t('selectSeries')}
          periodLabel={t('period')}
          deselectAllLabel={t('deselectAll')}
          labels={{
            activeUsers: t('activeUsers'),
            dailyActiveUsers: t('dailyActiveUsers'),
            weeklyActiveUsers: t('weeklyActiveUsers'),
            monthlyActiveUsers: t('monthlyActiveUsers'),
            activeHouseholds: t('activeHouseholds'),
            transactionsCreated: t('transactionsCreated'),
            transactionsUpdated: t('transactionsUpdated'),
            transactionsDeleted: t('transactionsDeleted'),
            registrations: t('newUsers'),
          }}
        />
      </section>

      <section className="adminPanel" aria-labelledby="transaction-mix">
        <div className="adminSectionHeading">
          <h2 id="transaction-mix">{t('transactionMix')}</h2>
        </div>
        <div className="adminBars">
          <div className="adminBarRow">
            <div className="adminMixLegend">
              {data.transactionMix.kinds.map((item) => (
                <span key={item.kind}>
                  {item.kind === 'income' ? t('incomes') : t('expenses')}:{' '}
                  <strong>
                    {numbers.format(item.count)} · {percent.format(item.percentage)}%
                  </strong>
                </span>
              ))}
            </div>
            <div
              className="adminBarTrack adminBarTrackStacked"
              aria-label={data.transactionMix.kinds
                .map((item) => `${item.kind}: ${percent.format(item.percentage)}%`)
                .join(', ')}
            >
              {data.transactionMix.kinds.map((item) => (
                <span
                  key={item.kind}
                  data-kind={item.kind}
                  style={{ width: `${item.percentage}%` }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="adminMetricStrip">
          {(
            [
              [t('transactionsCreated'), data.transactionMix.operations.created],
              [t('transactionsUpdated'), data.transactionMix.operations.updated],
              [t('transactionsDeleted'), data.transactionMix.operations.deleted],
              [t('recurring'), data.transactionMix.recurrence.recurring],
              [t('oneOff'), data.transactionMix.recurrence.oneOff],
            ] as const
          ).map(([label, value]) => (
            <div className="adminMetric" key={label}>
              <span>{label}</span>
              <strong>{numbers.format(value)}</strong>
            </div>
          ))}
        </div>
        <div className="adminTableWrap">
          <table className="adminDataTable">
            <thead>
              <tr>
                <th>{t('currency')}</th>
                <th>{t('type')}</th>
                <th>{t('count')}</th>
                <th>{t('amount')}</th>
                <th>{t('average')}</th>
                <th>{t('median')}</th>
              </tr>
            </thead>
            <tbody>
              {data.transactionMix.currencies.map((item) => (
                <tr key={`${item.currency}-${item.kind}`}>
                  <td>{item.currency}</td>
                  <td>{item.kind === 'income' ? t('incomes') : t('expenses')}</td>
                  <td>{item.count}</td>
                  <td>{item.amount}</td>
                  <td>{item.average}</td>
                  <td>{item.median}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="adminCoverage">{t('amountCoverageNote')}</p>
        {data.transactionMix.expenseTypes.length ? (
          <div className="adminBars adminScrollBox">
            <h3>{t('expenseTypes')}</h3>
            {data.transactionMix.expenseTypes.map((item) => (
              <div className="adminBarRow" key={item.type}>
                <div>
                  <span>{item.type}</span>
                  <strong>{numbers.format(item.count)}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="adminPanel" aria-labelledby="engagement">
        <div className="adminSectionHeading">
          <h2 id="engagement">{t('engagement')}</h2>
        </div>
        <div className="adminMetricStrip">
          {(
            [
              [t('stickiness'), data.engagement.stickiness],
              [t('transactionsPerUser'), data.engagement.transactionsPerActiveUser],
              [t('userActivityRate'), data.engagement.registeredUserActivityRate],
              [t('householdActivityRate'), data.engagement.activeHouseholdRate],
              [t('returning7'), data.engagement.returningAfter7Days],
              [t('returning30'), data.engagement.returningAfter30Days],
            ] as const
          ).map(([label, value]) => (
            <div className="adminMetric" key={label}>
              <span>{label}</span>
              <strong>{value == null ? '—' : percent.format(value)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function SeverityLedger({ data }: { data: AdminDashboardResponse }) {
  const t = await getTranslations('Admin');
  const severities = [
    ['warn', t('warning')],
    ['error', t('error')],
    ['fatal', t('fatal')],
  ] as const;

  return (
    <section className="adminPanel" aria-labelledby="severity-ledger">
      <div className="adminSectionHeading">
        <h2 id="severity-ledger">{t('severity')}</h2>
        <span>{t('logWindow', { days: data.health.windowDays })}</span>
      </div>
      <div className="adminSeverityGrid">
        {severities.map(([level, label]) => (
          <div className="adminSeverity" data-level={level} key={level}>
            <span>{label}</span>
            <strong>{data.health.counts[level]}</strong>
            <small>
              {data.health.last24Hours[level]} · {t('last24Hours')}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}

async function LogTable({
  entries,
  dates,
  title,
}: {
  entries: AdminLogEntry[];
  dates: Intl.DateTimeFormat;
  title: string;
}) {
  const t = await getTranslations('Admin');
  return (
    <section className="adminPanel adminLogPanel" aria-labelledby="health-events">
      <div className="adminSectionHeading">
        <h2 id="health-events">{title}</h2>
        <span>{entries.length}</span>
      </div>
      {entries.length ? (
        <HealthEventTable
          entries={entries}
          locale={dates.resolvedOptions().locale}
          labels={{
            event: t('event'),
            source: t('source'),
            time: t('time'),
            details: t('errorDetails'),
            close: t('close'),
            version: t('version'),
          }}
        />
      ) : (
        <p className="adminEmpty">{t('noEvents')}</p>
      )}
    </section>
  );
}

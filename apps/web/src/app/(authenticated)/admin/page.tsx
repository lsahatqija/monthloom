import {
  adminDashboardResponseSchema,
  type AdminDashboardResponse,
  type AdminLogEntry,
} from '@monthloom/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { apiClient } from '../../../lib/api/client';
import { getServerUser } from '../../../lib/auth/get-server-user';

import './admin.css';

type AdminView = 'overview' | 'health' | 'usage';

export default async function AdminPage({ searchParams }: { searchParams: { view?: string } }) {
  const user = await getServerUser();
  if (!user || user.role !== 'admin') redirect('/');

  const view: AdminView = ['health', 'usage'].includes(searchParams.view ?? '')
    ? (searchParams.view as AdminView)
    : 'overview';
  const cookieHeader = cookies().toString();
  const response = await apiClient.get<AdminDashboardResponse>('admin/dashboard', { cookieHeader });
  const data = adminDashboardResponseSchema.parse(response);
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
  ];

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
            href={`/admin?view=${tab.view}`}
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
      {view === 'usage' ? <Usage data={data} numbers={numbers} /> : null}
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
    [t('activeUsers'), data.metrics.activeUsers],
    [t('households'), data.metrics.households],
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

async function Usage({
  data,
  numbers,
}: {
  data: AdminDashboardResponse;
  numbers: Intl.NumberFormat;
}) {
  const t = await getTranslations('Admin');
  const metrics = [
    [t('totalUsers'), data.metrics.totalUsers, undefined],
    [t('activeUsers'), data.metrics.activeUsers, t('activeUsersHint')],
    [t('households'), data.metrics.households, undefined],
    [t('transactions'), data.metrics.transactions, undefined],
  ] as const;
  const total = Math.max(data.metrics.transactions, 1);
  const transactionTypes = [
    [t('incomes'), data.metrics.incomes],
    [t('expenses'), data.metrics.expenses],
  ] as const;

  return (
    <div className="adminView">
      <section className="adminPanel" aria-labelledby="usage-summary">
        <div className="adminSectionHeading">
          <h2 id="usage-summary">{t('usageSummary')}</h2>
        </div>
        <div className="adminMetricStrip">
          {metrics.map(([label, value, hint]) => (
            <div key={label} className="adminMetric" title={hint}>
              <span>{label}</span>
              <strong>{numbers.format(value)}</strong>
              {hint ? <small>{hint}</small> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="adminPanel" aria-labelledby="transaction-mix">
        <div className="adminSectionHeading">
          <h2 id="transaction-mix">{t('transactionMix')}</h2>
        </div>
        <div className="adminBars">
          {transactionTypes.map(([label, value]) => (
            <div className="adminBarRow" key={label}>
              <div>
                <span>{label}</span>
                <strong>{numbers.format(value)}</strong>
              </div>
              <div className="adminBarTrack" aria-hidden="true">
                <span style={{ width: `${(value / total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
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
        <div className="adminTableWrap">
          <table className="adminLogTable">
            <thead>
              <tr>
                <th>{t('event')}</th>
                <th>{t('source')}</th>
                <th>{t('time')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={`${entry.timestamp}-${entry.level}-${index}`}>
                  <td>
                    <div className="adminLogEvent">
                      <span className="adminLevel" data-level={entry.level}>
                        {entry.level}
                      </span>
                      <span>
                        <strong>{entry.message}</strong>
                        {entry.detail ? <small>{entry.detail}</small> : null}
                      </span>
                    </div>
                  </td>
                  <td>{entry.category}</td>
                  <td className="adminNumeric">{dates.format(new Date(entry.timestamp))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="adminEmpty">{t('noEvents')}</p>
      )}
    </section>
  );
}

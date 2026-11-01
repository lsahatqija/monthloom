'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

import { SEMANTIC_CHART_COLORS, type ChartTheme } from './aggregation/colors';
import { checkedAdd } from './aggregation/helpers';
import type { BalancePoint, BalanceViewModel, ProjectionSplit } from './aggregation/types';
import { formatCurrency, formatDateLabel, formatDayLabel } from './formatters';
import { useChartAnimation } from './use-chart-animation';

type BalanceSeries = 'income' | 'expenses' | 'balance';

interface ChartPoint {
  date: string;
  anchor: boolean;
  incomeRealized: number;
  incomeProjected: number;
  incomeHasProjection: boolean;
  incomeTotal: number;
  expensesRealized: number;
  expensesProjected: number;
  expensesHasProjection: boolean;
  expensesTotal: number;
  balanceRealized: number;
  balanceProjected: number;
  balanceHasProjection: boolean;
  balanceTotal: number;
}

interface BalanceTotals {
  income: ProjectionSplit;
  expenses: ProjectionSplit;
  balance: ProjectionSplit;
}

const BALANCE_VALUE_KEYS = [
  'incomeRealized',
  'incomeProjected',
  'incomeTotal',
  'expensesRealized',
  'expensesProjected',
  'expensesTotal',
  'balanceRealized',
  'balanceProjected',
  'balanceTotal',
] as const satisfies ReadonlyArray<keyof ChartPoint>;

function baselineData(data: ChartPoint[]): ChartPoint[] {
  return data.map((point) => {
    const baseline = { ...point };
    for (const key of BALANCE_VALUE_KEYS) baseline[key] = 0;
    return baseline;
  });
}

function useBalanceEntrance(data: ChartPoint[], enabled: boolean) {
  const [state, setState] = useState(() => ({
    source: data,
    data: enabled ? baselineData(data) : data,
    animate: false,
  }));

  useEffect(() => {
    if (!enabled) {
      setState({ source: data, data, animate: false });
      return;
    }

    setState({ source: data, data: baselineData(data), animate: false });
    const frame = window.requestAnimationFrame(() => {
      setState({ source: data, data, animate: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [data, enabled]);

  if (state.source !== data) {
    return { data: enabled ? baselineData(data) : data, animate: false };
  }
  return state;
}

function chartPoint(
  point: BalancePoint,
  previous: BalancePoint | undefined,
  mode: BalanceViewModel['mode'],
): ChartPoint {
  const hasProjection = (series: BalanceSeries) =>
    mode === 'daily'
      ? point[series].projectedCents !== 0
      : point[series].projectedCents !== (previous?.[series].projectedCents ?? 0);
  return {
    date: point.date,
    anchor: point.anchor,
    incomeRealized: point.income.realizedCents,
    incomeProjected: point.income.projectedCents,
    incomeHasProjection: hasProjection('income'),
    incomeTotal: point.income.totalCents,
    expensesRealized: point.expenses.realizedCents,
    expensesProjected: point.expenses.projectedCents,
    expensesHasProjection: hasProjection('expenses'),
    expensesTotal: point.expenses.totalCents,
    balanceRealized: point.balance.realizedCents,
    balanceProjected: point.balance.projectedCents,
    balanceHasProjection: hasProjection('balance'),
    balanceTotal: point.balance.totalCents,
  };
}

function addSplit(left: ProjectionSplit, right: ProjectionSplit): ProjectionSplit {
  return {
    realizedCents: checkedAdd(left.realizedCents, right.realizedCents),
    projectedCents: checkedAdd(left.projectedCents, right.projectedCents),
    totalCents: checkedAdd(left.totalCents, right.totalCents),
  };
}

function zeroOffset(data: ChartPoint[], key: 'balanceRealized' | 'balanceTotal'): string {
  const maximum = Math.max(0, ...data.map((point) => point[key]));
  const minimum = Math.min(0, ...data.map((point) => point[key]));
  if (maximum === 0) return '0%';
  if (minimum === 0) return '100%';
  return `${(maximum / (maximum - minimum)) * 100}%`;
}

function balanceTotals(model: BalanceViewModel): BalanceTotals {
  const zero = (): ProjectionSplit => ({ realizedCents: 0, projectedCents: 0, totalCents: 0 });
  const empty = { income: zero(), expenses: zero(), balance: zero() };
  if (model.mode === 'cumulative') {
    const final = model.points.at(-1);
    return final
      ? { income: final.income, expenses: final.expenses, balance: final.balance }
      : empty;
  }
  return model.points.reduce<BalanceTotals>(
    (totals, point) => ({
      income: addSplit(totals.income, point.income),
      expenses: addSplit(totals.expenses, point.expenses),
      balance: addSplit(totals.balance, point.balance),
    }),
    empty,
  );
}

function ProjectedDot({
  cx,
  cy,
  payload,
  projectedKey,
  color,
}: {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
  projectedKey: keyof ChartPoint;
  color: string;
}) {
  if (cx === undefined || cy === undefined || !payload || !payload[projectedKey]) return null;
  return <circle cx={cx} cy={cy} r={4} fill="var(--ml-surface)" stroke={color} strokeWidth={2} />;
}

function BalanceTooltip({
  active,
  payload,
  currency,
  locale,
}: TooltipContentProps & { currency: string; locale: string }) {
  const t = useTranslations('Graph.balance');
  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!active || !point) return null;

  return (
    <div className="graphTooltip">
      <strong>
        {formatDateLabel(point.date, locale)}
        {point.anchor ? ` · ${t('start')}` : ''}
      </strong>
      {(['income', 'expenses', 'balance'] as const).map((series) => (
        <div key={series}>
          <span>{t(series)}</span>
          <span>{formatCurrency(point[`${series}Realized`], currency, locale)}</span>
          <span>{formatCurrency(point[`${series}Projected`], currency, locale)}</span>
          <strong>{formatCurrency(point[`${series}Total`], currency, locale)}</strong>
        </div>
      ))}
      <small>{t('tooltipOrder')}</small>
    </div>
  );
}

function ChartFrame({
  children,
  label,
  description,
}: {
  children: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="graphChartCanvas" aria-label={label} aria-describedby="balance-chart-summary">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
      <span className="srOnly">{description}</span>
    </div>
  );
}

function Axes({
  domain,
  currency,
  locale,
}: {
  domain: readonly [number, number];
  currency: string;
  locale: string;
}) {
  const t = useTranslations('Graph.balance');
  return (
    <>
      <CartesianGrid stroke="var(--ml-divider)" vertical={false} />
      <XAxis
        dataKey="date"
        tickFormatter={(date: string) => formatDayLabel(date, locale)}
        interval="preserveStartEnd"
        minTickGap={32}
        tick={{ fill: 'var(--ml-text-muted)', fontSize: 12 }}
        tickLine={false}
        axisLine={{ stroke: 'var(--ml-border)' }}
      />
      <YAxis
        domain={[domain[0], domain[1]]}
        tickFormatter={(value: number) => formatCurrency(value, currency, locale)}
        width={82}
        tick={{ fill: 'var(--ml-text-muted)', fontSize: 12 }}
        tickLine={false}
        axisLine={false}
      />
      <ReferenceLine
        y={0}
        stroke="var(--ml-text-muted)"
        strokeWidth={1.5}
        label={{ value: t('zero'), position: 'insideTopLeft', fill: 'var(--ml-text-muted)' }}
      />
    </>
  );
}

function BalanceLineChart({
  data,
  model,
  currency,
  locale,
  theme,
  animationActive,
}: {
  data: ChartPoint[];
  model: BalanceViewModel;
  currency: string;
  locale: string;
  theme: ChartTheme;
  animationActive: boolean;
}) {
  const t = useTranslations('Graph.balance');
  const colors = SEMANTIC_CHART_COLORS[theme];
  const series = [
    ['income', colors.income],
    ['expenses', colors.expense],
    ['balance', colors.balance],
  ] as const;

  return (
    <ChartFrame label={t('lineChartLabel')} description={t('lineChartDescription')}>
      <LineChart
        data={data}
        margin={{ top: 24, right: 16, bottom: 8, left: 8 }}
        accessibilityLayer
        title={t('lineChartLabel')}
        desc={t('lineChartDescription')}
      >
        <Axes domain={model.domain} currency={currency} locale={locale} />
        <Tooltip
          content={(props) => <BalanceTooltip {...props} currency={currency} locale={locale} />}
          isAnimationActive="auto"
        />
        {series.map(([key, color]) => (
          <Line
            key={`${key}-total`}
            type="linear"
            dataKey={`${key}Total`}
            name={`${t(key)} · ${t('total')}`}
            stroke={color}
            strokeWidth={2}
            strokeDasharray="7 5"
            dot={(props) => (
              <ProjectedDot {...props} projectedKey={`${key}HasProjection`} color={color} />
            )}
            activeDot={{ r: 5, strokeWidth: 2, fill: 'var(--ml-surface)' }}
            isAnimationActive={animationActive}
            animationDuration={650}
            animationEasing="ease-out"
          />
        ))}
        {series.map(([key, color]) => (
          <Line
            key={`${key}-realized`}
            type="linear"
            dataKey={`${key}Realized`}
            name={`${t(key)} · ${t('realized')}`}
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={animationActive}
            animationDuration={650}
            animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

function BalanceAreaChart({
  data,
  model,
  currency,
  locale,
  theme,
  animationActive,
}: {
  data: ChartPoint[];
  model: BalanceViewModel;
  currency: string;
  locale: string;
  theme: ChartTheme;
  animationActive: boolean;
}) {
  const t = useTranslations('Graph.balance');
  const colors = SEMANTIC_CHART_COLORS[theme];
  const realizedZero = zeroOffset(data, 'balanceRealized');
  const totalZero = zeroOffset(data, 'balanceTotal');
  return (
    <ChartFrame label={t('areaChartLabel')} description={t('areaChartDescription')}>
      <AreaChart
        data={data}
        margin={{ top: 24, right: 16, bottom: 8, left: 8 }}
        accessibilityLayer
        title={t('areaChartLabel')}
        desc={t('areaChartDescription')}
      >
        <defs>
          <linearGradient id="balance-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.positiveBalance} stopOpacity={0.3} />
            <stop offset={realizedZero} stopColor={colors.positiveBalance} stopOpacity={0.16} />
            <stop offset={realizedZero} stopColor={colors.negativeBalance} stopOpacity={0.16} />
            <stop offset="100%" stopColor={colors.negativeBalance} stopOpacity={0.3} />
          </linearGradient>
          <linearGradient id="balance-area-stroke-realized" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.positiveBalance} />
            <stop offset={realizedZero} stopColor={colors.positiveBalance} />
            <stop offset={realizedZero} stopColor={colors.negativeBalance} />
            <stop offset="100%" stopColor={colors.negativeBalance} />
          </linearGradient>
          <linearGradient id="balance-area-stroke-total" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.positiveBalance} />
            <stop offset={totalZero} stopColor={colors.positiveBalance} />
            <stop offset={totalZero} stopColor={colors.negativeBalance} />
            <stop offset="100%" stopColor={colors.negativeBalance} />
          </linearGradient>
          <pattern
            id="balance-projected-fill"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke={colors.projected} strokeWidth="3" />
          </pattern>
        </defs>
        <Axes domain={model.domain} currency={currency} locale={locale} />
        <Tooltip
          content={(props) => <BalanceTooltip {...props} currency={currency} locale={locale} />}
          isAnimationActive="auto"
        />
        <Area
          type="linear"
          dataKey="balanceTotal"
          name={`${t('balance')} · ${t('total')}`}
          stroke="url(#balance-area-stroke-total)"
          strokeWidth={2}
          strokeDasharray="7 5"
          fill="url(#balance-projected-fill)"
          fillOpacity={0.32}
          baseValue={0}
          isAnimationActive={animationActive}
          animationDuration={650}
          animationEasing="ease-out"
        />
        <Area
          type="linear"
          dataKey="balanceRealized"
          name={`${t('balance')} · ${t('realized')}`}
          stroke="url(#balance-area-stroke-realized)"
          strokeWidth={2.5}
          fill="url(#balance-area-fill)"
          baseValue={0}
          isAnimationActive={animationActive}
          animationDuration={650}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ChartFrame>
  );
}

function BalanceLegend({
  totals,
  currency,
  locale,
  theme,
}: {
  totals: BalanceTotals;
  currency: string;
  locale: string;
  theme: ChartTheme;
}) {
  const t = useTranslations('Graph.balance');
  const colors = SEMANTIC_CHART_COLORS[theme];
  const series: Array<[BalanceSeries, string]> = [
    ['income', colors.income],
    ['expenses', colors.expense],
    ['balance', colors.balance],
  ];
  return (
    <ul className="graphBalanceLegend">
      {series.map(([key, color]) => (
        <li key={key}>
          <span className="graphLegendName">
            <span className="graphLegendSolid" style={{ borderColor: color }} aria-hidden="true" />
            <strong>{t(key)}</strong>
          </span>
          <span>
            {t('realized')}: {formatCurrency(totals[key].realizedCents, currency, locale)}
          </span>
          <span className="graphLegendProjected">
            <span className="graphLegendDash" style={{ borderColor: color }} aria-hidden="true" />
            {t('projected')}: {formatCurrency(totals[key].projectedCents, currency, locale)}
          </span>
          <strong>
            {t('total')}: {formatCurrency(totals[key].totalCents, currency, locale)}
          </strong>
        </li>
      ))}
    </ul>
  );
}

function BalanceTable({
  points,
  currency,
  locale,
}: {
  points: BalancePoint[];
  currency: string;
  locale: string;
}) {
  const t = useTranslations('Graph.balance');
  const columns = (['income', 'expenses', 'balance'] as const).flatMap((series) =>
    (['realized', 'projected', 'total'] as const).map((state) => ({ series, state })),
  );
  return (
    <details className="graphDataDisclosure">
      <summary>{t('showDataTable')}</summary>
      <div className="graphTableScroll">
        <table>
          <caption>{t('dataTableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('date')}</th>
              {columns.map(({ series, state }) => (
                <th key={`${series}-${state}`} scope="col">
                  {t('column', { series: t(series), state: t(state) })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={`${point.date}-${point.anchor ? 'anchor' : index}`}>
                <th scope="row">
                  {formatDayLabel(point.date, locale)}
                  {point.anchor ? ` · ${t('start')}` : ''}
                </th>
                {columns.map(({ series, state }) => {
                  const cents = point[series][`${state}Cents`];
                  return (
                    <td key={`${series}-${state}`}>{formatCurrency(cents, currency, locale)}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function BalanceChart({
  model,
  variant,
  currency,
  theme = 'light',
}: {
  model: BalanceViewModel;
  variant: 'line' | 'area';
  currency: string;
  theme?: ChartTheme;
}) {
  const locale = useLocale();
  const t = useTranslations('Graph.balance');
  const animationEnabled = useChartAnimation();
  const data = useMemo(
    () =>
      model.points.map((point, index) => chartPoint(point, model.points[index - 1], model.mode)),
    [model],
  );
  const entrance = useBalanceEntrance(data, animationEnabled);
  const totals = balanceTotals(model);

  return (
    <>
      <p id="balance-chart-summary" className="graphChartSummary">
        {t('summary', {
          income: formatCurrency(totals.income.totalCents, currency, locale),
          expenses: formatCurrency(totals.expenses.totalCents, currency, locale),
          balance: formatCurrency(totals.balance.totalCents, currency, locale),
          projected: formatCurrency(totals.balance.projectedCents, currency, locale),
        })}
      </p>
      {variant === 'line' ? (
        <BalanceLineChart
          data={entrance.data}
          model={model}
          currency={currency}
          locale={locale}
          theme={theme}
          animationActive={entrance.animate}
        />
      ) : (
        <BalanceAreaChart
          data={entrance.data}
          model={model}
          currency={currency}
          locale={locale}
          theme={theme}
          animationActive={entrance.animate}
        />
      )}
      <BalanceLegend totals={totals} currency={currency} locale={locale} theme={theme} />
      <BalanceTable points={model.points} currency={currency} locale={locale} />
    </>
  );
}

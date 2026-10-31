'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

import { checkedAdd } from './aggregation/helpers';
import type { CategoryGroup, CategoryViewModel } from './aggregation/types';
import { formatCurrency, formatPercentage } from './formatters';

type CategoryVariant = 'pie' | 'bar' | 'radial';

interface CategorySlice {
  groupKey: string;
  label: string;
  state: 'realized' | 'projected';
  value: number;
  groupIndex: number;
}

function useNarrowChart() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(max-width: 700px)');
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return narrow;
}

function PatternShape({ pattern }: { pattern: CategoryGroup['pattern'] }) {
  if (pattern === 'diagonal') {
    return <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" className="graphPatternMark" />;
  }
  if (pattern === 'dots') {
    return <circle cx="3" cy="3" r="1.3" className="graphPatternDot" />;
  }
  if (pattern === 'crosshatch') {
    return (
      <path
        d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6 M-2 6 L2 10 M0 0 L8 8 M6 -2 L10 2"
        className="graphPatternMark"
      />
    );
  }
  return null;
}

function CategoryPatterns({ groups, prefix }: { groups: CategoryGroup[]; prefix: string }) {
  return (
    <defs>
      {groups.map((group, index) => (
        <pattern
          id={`${prefix}-${index}`}
          key={group.key}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <rect width="8" height="8" fill={group.color} />
          <PatternShape pattern={group.pattern} />
        </pattern>
      ))}
    </defs>
  );
}

function CategoryTooltip({
  active,
  payload,
  groups,
  currency,
  locale,
}: TooltipContentProps & {
  groups: CategoryGroup[];
  currency: string;
  locale: string;
}) {
  const t = useTranslations('Graph');
  const item = payload[0]?.payload as { key?: string; groupKey?: string } | undefined;
  const group = groups.find(({ key }) => key === (item?.groupKey ?? item?.key));
  if (!active || !group) return null;

  return (
    <div className="graphTooltip graphCategoryTooltip">
      <strong>{group.label}</strong>
      <div>
        <span>{t('balance.realized')}</span>
        <span>{formatCurrency(group.realizedCents, currency, locale)}</span>
      </div>
      <div>
        <span>{t('balance.projected')}</span>
        <span>{formatCurrency(group.projectedCents, currency, locale)}</span>
      </div>
      <div>
        <span>{t('balance.total')}</span>
        <strong>{formatCurrency(group.totalCents, currency, locale)}</strong>
      </div>
      <small>{formatPercentage(group.percentage, locale)}</small>
    </div>
  );
}

function CategoryPie({
  model,
  currency,
  locale,
  patternPrefix,
}: {
  model: CategoryViewModel;
  currency: string;
  locale: string;
  patternPrefix: string;
}) {
  const t = useTranslations('Graph.category');
  const slices = model.groups.flatMap<CategorySlice>((group, groupIndex) => [
    ...(group.realizedCents
      ? [
          {
            groupKey: group.key,
            label: group.label,
            state: 'realized' as const,
            value: group.realizedCents,
            groupIndex,
          },
        ]
      : []),
    ...(group.projectedCents
      ? [
          {
            groupKey: group.key,
            label: group.label,
            state: 'projected' as const,
            value: group.projectedCents,
            groupIndex,
          },
        ]
      : []),
  ]);

  return (
    <div
      className="graphChartCanvas"
      aria-label={t('pieChartLabel')}
      aria-describedby="category-chart-summary"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart accessibilityLayer title={t('pieChartLabel')} desc={t('pieChartDescription')}>
          <CategoryPatterns groups={model.groups} prefix={patternPrefix} />
          <Tooltip
            content={(props) => (
              <CategoryTooltip
                {...props}
                groups={model.groups}
                currency={currency}
                locale={locale}
              />
            )}
            isAnimationActive="auto"
          />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            startAngle={90}
            endAngle={-270}
            outerRadius="86%"
            isAnimationActive={false}
          >
            {slices.map((slice, index) => (
              <Cell
                key={`${slice.groupKey}-${slice.state}-${index}`}
                fill={`url(#${patternPrefix}-${slice.groupIndex})`}
                fillOpacity={slice.state === 'projected' ? 0.48 : 1}
                stroke={model.groups[slice.groupIndex]!.color}
                strokeWidth={slice.state === 'projected' ? 2 : 1}
                strokeDasharray={slice.state === 'projected' ? '4 3' : undefined}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryBars({
  model,
  currency,
  locale,
  patternPrefix,
  narrow,
}: {
  model: CategoryViewModel;
  currency: string;
  locale: string;
  patternPrefix: string;
  narrow: boolean;
}) {
  const t = useTranslations('Graph.category');
  const height = narrow ? `${Math.max(20, model.groups.length * 2.75)}rem` : undefined;
  const cells = (projected: boolean) =>
    model.groups.map((group, index) => (
      <Cell
        key={group.key}
        fill={`url(#${patternPrefix}-${index})`}
        fillOpacity={projected ? 0.48 : 1}
        stroke={group.color}
        strokeDasharray={projected ? '4 3' : undefined}
      />
    ));

  return (
    <div
      className="graphChartCanvas graphCategoryBarCanvas"
      style={{ height }}
      aria-label={t('barChartLabel')}
      aria-describedby="category-chart-summary"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={model.groups}
          layout={narrow ? 'vertical' : 'horizontal'}
          margin={
            narrow
              ? { top: 12, right: 12, bottom: 8, left: 8 }
              : { top: 16, right: 12, bottom: 64, left: 8 }
          }
          accessibilityLayer
          title={t('barChartLabel')}
          desc={t('barChartDescription')}
        >
          <CategoryPatterns groups={model.groups} prefix={patternPrefix} />
          <CartesianGrid stroke="var(--ml-divider)" vertical={narrow} horizontal={!narrow} />
          {narrow ? (
            <>
              <XAxis
                type="number"
                tickFormatter={(value: number) => formatCurrency(value, currency, locale)}
                tick={{ fill: 'var(--ml-text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--ml-border)' }}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={112}
                tick={{ fill: 'var(--ml-text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                type="category"
                dataKey="label"
                interval={0}
                angle={-28}
                height={76}
                textAnchor="end"
                tick={{ fill: 'var(--ml-text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--ml-border)' }}
              />
              <YAxis
                type="number"
                tickFormatter={(value: number) => formatCurrency(value, currency, locale)}
                width={82}
                tick={{ fill: 'var(--ml-text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
            </>
          )}
          <Tooltip
            content={(props) => (
              <CategoryTooltip
                {...props}
                groups={model.groups}
                currency={currency}
                locale={locale}
              />
            )}
            isAnimationActive="auto"
          />
          <Bar dataKey="realizedCents" stackId="category" isAnimationActive={false}>
            {cells(false)}
          </Bar>
          <Bar dataKey="projectedCents" stackId="category" isAnimationActive={false}>
            {cells(true)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryRadial({
  model,
  currency,
  locale,
  patternPrefix,
}: {
  model: CategoryViewModel;
  currency: string;
  locale: string;
  patternPrefix: string;
}) {
  const t = useTranslations('Graph.category');
  const cells = (projected: boolean) =>
    model.groups.map((group, index) => (
      <Cell
        key={group.key}
        fill={`url(#${patternPrefix}-${index})`}
        fillOpacity={projected ? 0.48 : 1}
        stroke={group.color}
        strokeDasharray={projected ? '4 3' : undefined}
      />
    ));

  return (
    <div
      className="graphChartCanvas"
      aria-label={t('radialChartLabel')}
      aria-describedby="category-chart-summary"
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={model.groups}
          innerRadius="18%"
          outerRadius="92%"
          startAngle={90}
          endAngle={-270}
          accessibilityLayer
          title={t('radialChartLabel')}
          desc={t('radialChartDescription')}
        >
          <CategoryPatterns groups={model.groups} prefix={patternPrefix} />
          <Tooltip
            content={(props) => (
              <CategoryTooltip
                {...props}
                groups={model.groups}
                currency={currency}
                locale={locale}
              />
            )}
            isAnimationActive="auto"
          />
          <RadialBar
            dataKey="realizedCents"
            stackId="category"
            background={{ fill: 'var(--ml-divider)' }}
            isAnimationActive={false}
          >
            {cells(false)}
          </RadialBar>
          <RadialBar dataKey="projectedCents" stackId="category" isAnimationActive={false}>
            {cells(true)}
          </RadialBar>
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryLegend({
  groups,
  currency,
  locale,
}: {
  groups: CategoryGroup[];
  currency: string;
  locale: string;
}) {
  const t = useTranslations('Graph');
  return (
    <ul className="graphCategoryLegend" aria-label={t('category.legendLabel')}>
      {groups.map((group) => (
        <li key={group.key}>
          <span
            className={`graphCategorySwatch graphCategoryPattern-${group.pattern}`}
            style={{ backgroundColor: group.color }}
            aria-hidden="true"
          />
          <span className="graphCategoryLegendName">
            <strong>{group.label}</strong>
            <span>{formatPercentage(group.percentage, locale)}</span>
          </span>
          <span>
            {t('balance.realized')}: {formatCurrency(group.realizedCents, currency, locale)}
          </span>
          <span className="graphLegendProjected">
            <span
              className="graphLegendDash"
              style={{ borderColor: group.color }}
              aria-hidden="true"
            />
            {t('balance.projected')}: {formatCurrency(group.projectedCents, currency, locale)}
          </span>
          <strong>{formatCurrency(group.totalCents, currency, locale)}</strong>
        </li>
      ))}
    </ul>
  );
}

function CategoryTable({
  groups,
  currency,
  locale,
}: {
  groups: CategoryGroup[];
  currency: string;
  locale: string;
}) {
  const t = useTranslations('Graph');
  return (
    <details className="graphDataDisclosure">
      <summary>{t('balance.showDataTable')}</summary>
      <div className="graphTableScroll graphCategoryTable">
        <table>
          <caption>{t('category.dataTableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('category.category')}</th>
              <th scope="col">{t('category.percentage')}</th>
              <th scope="col">{t('balance.realized')}</th>
              <th scope="col">{t('balance.projected')}</th>
              <th scope="col">{t('balance.total')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.key}>
                <th scope="row">{group.label}</th>
                <td>{formatPercentage(group.percentage, locale)}</td>
                <td>{formatCurrency(group.realizedCents, currency, locale)}</td>
                <td>{formatCurrency(group.projectedCents, currency, locale)}</td>
                <td>{formatCurrency(group.totalCents, currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function CategoryChart({
  model,
  variant,
  currency,
}: {
  model: CategoryViewModel;
  variant: CategoryVariant;
  currency: string;
}) {
  const locale = useLocale();
  const t = useTranslations('Graph.category');
  const narrow = useNarrowChart();
  const patternPrefix = `category-pattern-${useId().replace(/:/g, '')}`;
  const largest = model.groups[0]!;
  const projectedCents = model.groups.reduce(
    (sum, group) => checkedAdd(sum, group.projectedCents),
    0,
  );

  return (
    <>
      <p id="category-chart-summary" className="graphChartSummary">
        {t('summary', {
          total: formatCurrency(model.totalCents, currency, locale),
          count: model.groups.length,
          label: largest.label,
          amount: formatCurrency(largest.totalCents, currency, locale),
          percentage: formatPercentage(largest.percentage, locale),
          projected: formatCurrency(projectedCents, currency, locale),
        })}
      </p>
      {variant === 'pie' ? (
        <CategoryPie
          model={model}
          currency={currency}
          locale={locale}
          patternPrefix={patternPrefix}
        />
      ) : variant === 'bar' ? (
        <CategoryBars
          model={model}
          currency={currency}
          locale={locale}
          patternPrefix={patternPrefix}
          narrow={narrow}
        />
      ) : (
        <CategoryRadial
          model={model}
          currency={currency}
          locale={locale}
          patternPrefix={patternPrefix}
        />
      )}
      <CategoryLegend groups={model.groups} currency={currency} locale={locale} />
      <CategoryTable groups={model.groups} currency={currency} locale={locale} />
    </>
  );
}

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from 'recharts';

import { checkedAdd } from './aggregation/helpers';
import {
  overviewGraduations,
  overviewNormalizedAmount,
  overviewRawAmount,
} from './aggregation/overview';
import type { ChartStyle, OverviewSeries, OverviewViewModel } from './aggregation/types';
import { formatCurrency } from './formatters';
import { useChartAnimation } from './use-chart-animation';

type RadarDatum = Record<string, number | string> & {
  dimensionKey: string;
  label: string;
};

function PatternMark({ pattern, color }: ChartStyle) {
  if (pattern === 'diagonal') {
    return <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" stroke={color} />;
  }
  if (pattern === 'dots') return <circle cx="3" cy="3" r="1.4" fill={color} />;
  if (pattern === 'crosshatch') {
    return (
      <path
        d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6 M-2 6 L2 10 M0 0 L8 8 M6 -2 L10 2"
        stroke={color}
      />
    );
  }
  return null;
}

function OverviewPatterns({ series, prefix }: { series: OverviewSeries[]; prefix: string }) {
  return (
    <defs>
      {series.map((item, index) => (
        <pattern
          id={`${prefix}-${index}`}
          key={item.key}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <rect width="16" height="16" fill={item.color} />
          <g fill="none" strokeWidth="1" opacity="0.38" transform="translate(3 3) scale(0.65)">
            <PatternMark color="var(--ml-surface)" pattern={item.pattern} />
          </g>
        </pattern>
      ))}
    </defs>
  );
}

function seriesTotals(series: OverviewSeries) {
  return series.values.reduce(
    (total, value) => ({
      realizedCents: checkedAdd(total.realizedCents, value.realizedCents),
      projectedCents: checkedAdd(total.projectedCents, value.projectedCents),
      totalCents: checkedAdd(total.totalCents, value.totalCents),
    }),
    { realizedCents: 0, projectedCents: 0, totalCents: 0 },
  );
}

function OverviewTooltip({
  active,
  payload,
  model,
  currency,
  locale,
}: TooltipContentProps & {
  model: OverviewViewModel;
  currency: string;
  locale: string;
}) {
  const t = useTranslations('Graph');
  const datum = payload[0]?.payload as RadarDatum | undefined;
  const dimension = datum
    ? model.dimensions.find(({ key }) => key === datum.dimensionKey)
    : undefined;
  if (!active || !dimension) return null;

  return (
    <div className="graphTooltip graphOverviewTooltip">
      <strong>{dimension.label}</strong>
      {model.series.map((series) => {
        const value = series.values.find(({ dimensionKey }) => dimensionKey === dimension.key)!;
        return (
          <div key={series.key}>
            <span>{series.label}</span>
            <span>{formatCurrency(value.realizedCents, currency, locale)}</span>
            <span>{formatCurrency(value.projectedCents, currency, locale)}</span>
            <strong>{formatCurrency(value.totalCents, currency, locale)}</strong>
          </div>
        );
      })}
      <small>{t('balance.tooltipOrder')}</small>
    </div>
  );
}

function OverviewLegend({
  series,
  currency,
  locale,
}: {
  series: OverviewSeries[];
  currency: string;
  locale: string;
}) {
  const t = useTranslations('Graph');
  return (
    <ul className="graphOverviewLegend" aria-label={t('overview.legendLabel')}>
      {series.map((item) => {
        const total = seriesTotals(item);
        return (
          <li key={item.key}>
            <span
              className={`graphOverviewSwatch graphCategoryPattern-${item.pattern}`}
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <strong>{item.label}</strong>
            <span>
              {t('balance.realized')}: {formatCurrency(total.realizedCents, currency, locale)}
            </span>
            <span className="graphLegendProjected">
              <span
                className="graphLegendDash"
                style={{ borderColor: item.color }}
                aria-hidden="true"
              />
              {t('balance.projected')}: {formatCurrency(total.projectedCents, currency, locale)}
            </span>
            <strong>
              {t('balance.total')}: {formatCurrency(total.totalCents, currency, locale)}
            </strong>
          </li>
        );
      })}
    </ul>
  );
}

function OverviewTable({
  model,
  currency,
  locale,
}: {
  model: OverviewViewModel;
  currency: string;
  locale: string;
}) {
  const t = useTranslations('Graph');
  return (
    <details className="graphDataDisclosure">
      <summary>{t('balance.showDataTable')}</summary>
      <div className="graphTableScroll graphOverviewTable">
        <table>
          <caption>{t('overview.dataTableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('overview.dimension')}</th>
              {model.series.flatMap((series) =>
                (['realized', 'projected', 'total'] as const).map((state) => (
                  <th scope="col" key={`${series.key}-${state}`}>
                    {t('overview.column', { series: series.label, state: t(`balance.${state}`) })}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {model.dimensions.map((dimension, dimensionIndex) => (
              <tr key={dimension.key}>
                <th scope="row">{dimension.label}</th>
                {model.series.flatMap((series) => {
                  const value = series.values[dimensionIndex]!;
                  return [value.realizedCents, value.projectedCents, value.totalCents].map(
                    (amount, stateIndex) => (
                      <td key={`${series.key}-${stateIndex}`}>
                        {formatCurrency(amount, currency, locale)}
                      </td>
                    ),
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

export function OverviewChart({ model, currency }: { model: OverviewViewModel; currency: string }) {
  const locale = useLocale();
  const t = useTranslations('Graph.overview');
  const graphT = useTranslations('Graph');
  const patternPrefix = `overview-pattern-${useId().replace(/:/g, '')}`;
  const animationActive = useChartAnimation();
  const scaleTicks = overviewGraduations(model.highestAmountCents).map((amount) =>
    overviewNormalizedAmount(amount, model.highestAmountCents),
  );
  const labelStride = Math.max(1, Math.ceil(model.dimensions.length / 12));
  const data: RadarDatum[] = model.dimensions.map((dimension, dimensionIndex) => {
    const datum: RadarDatum = { dimensionKey: dimension.key, label: dimension.label };
    for (const series of model.series) {
      const value = series.values[dimensionIndex]!;
      datum[`${series.key}-realized`] = value.realizedNormalized;
      datum[`${series.key}-total`] = value.totalNormalized;
    }
    return datum;
  });
  const totalCents = model.series.reduce(
    (total, series) => checkedAdd(total, seriesTotals(series).totalCents),
    0,
  );

  return (
    <>
      <p
        id="overview-chart-summary"
        className="graphChartSummary"
        aria-live="polite"
        aria-atomic="true"
      >
        {t('summary', {
          total: formatCurrency(totalCents, currency, locale),
          dimensionCount: model.dimensions.length,
          userCount: model.selectedUserIds.length,
          maximum: formatCurrency(model.highestAmountCents, currency, locale),
        })}
      </p>
      <p className="srOnly">{graphT('keyboardHelp')}</p>
      <div
        className="graphChartCanvas graphOverviewCanvas"
        aria-label={t('chartLabel')}
        aria-describedby="overview-chart-summary"
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={data}
            outerRadius="76%"
            accessibilityLayer
            title={t('chartLabel')}
            desc={`${t('chartDescription')} ${graphT('keyboardHelp')}`}
          >
            <OverviewPatterns series={model.series} prefix={patternPrefix} />
            <PolarGrid
              gridType="polygon"
              stroke="color-mix(in srgb, var(--ml-divider) 72%, transparent)"
              strokeDasharray="2 4"
            />
            <PolarAngleAxis
              dataKey="label"
              tickFormatter={(value: string, index: number) =>
                index % labelStride === 0 ? value : ''
              }
              tick={{
                fill: 'var(--ml-text-muted)',
                fontSize: model.dimensions.length > 12 ? 9 : 11,
              }}
            />
            <PolarRadiusAxis
              domain={[0, 1]}
              ticks={scaleTicks}
              angle={90}
              tickFormatter={(value: number) =>
                formatCurrency(overviewRawAmount(value, model.highestAmountCents), currency, locale)
              }
              tick={{ fill: 'var(--ml-text-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={(props) => (
                <OverviewTooltip {...props} model={model} currency={currency} locale={locale} />
              )}
              isAnimationActive="auto"
            />
            {model.series.flatMap((series, index) => [
              <Radar
                key={`${series.key}-realized`}
                name={`${series.label} — ${graphT('balance.realized')}`}
                dataKey={`${series.key}-realized`}
                stroke={series.color}
                strokeWidth={2}
                fill={`url(#${patternPrefix}-${index})`}
                fillOpacity={model.series.length > 1 ? 0.13 : 0.22}
                isAnimationActive={animationActive}
                animationDuration={750}
                animationEasing="ease-out"
              />,
              <Radar
                key={`${series.key}-total`}
                name={`${series.label} — ${graphT('balance.total')}`}
                dataKey={`${series.key}-total`}
                stroke={series.color}
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
                isAnimationActive={animationActive}
                animationDuration={750}
                animationEasing="ease-out"
              />,
            ])}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <OverviewLegend series={model.series} currency={currency} locale={locale} />
      <OverviewTable model={model} currency={currency} locale={locale} />
    </>
  );
}

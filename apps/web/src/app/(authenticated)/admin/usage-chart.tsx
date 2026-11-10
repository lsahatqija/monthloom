'use client';

import type { AdminUsageResponse } from '@monthloom/contracts';
import { useState } from 'react';

type SeriesKey =
  | 'activeUsers'
  | 'dailyActiveUsers'
  | 'weeklyActiveUsers'
  | 'monthlyActiveUsers'
  | 'activeHouseholds'
  | 'transactionsCreated'
  | 'transactionsUpdated'
  | 'transactionsDeleted'
  | 'registrations';
const COLORS: Record<SeriesKey, string> = {
  activeUsers: '#315c4c',
  dailyActiveUsers: '#16705a',
  weeklyActiveUsers: '#b06b00',
  monthlyActiveUsers: '#a13f3f',
  activeHouseholds: '#8a5700',
  transactionsCreated: '#4769b0',
  transactionsUpdated: '#7a52a3',
  transactionsDeleted: '#a13f3f',
  registrations: '#287c7c',
};

export function UsageChart({
  data,
  labels,
  title,
  periodLabel,
  deselectAllLabel,
}: {
  data: AdminUsageResponse['series'];
  labels: Record<SeriesKey, string>;
  title: string;
  periodLabel: string;
  deselectAllLabel: string;
}) {
  const [selected, setSelected] = useState<SeriesKey[]>([
    'dailyActiveUsers',
    'transactionsCreated',
  ]);
  const [hovered, setHovered] = useState<number>();
  const width = 900,
    height = 300,
    left = 48,
    right = 48,
    top = 18,
    bottom = 42;
  const maximum = Math.max(1, ...data.flatMap((point) => selected.map((key) => point[key])));
  const roundedMaximum = Math.max(4, Math.ceil(maximum / 4) * 4);
  const ticks = Array.from({ length: 5 }, (_, index) => (roundedMaximum / 4) * index);
  const x = (index: number) =>
    left + (index * (width - left - right)) / Math.max(data.length - 1, 1);
  const y = (value: number) => height - bottom - (value / roundedMaximum) * (height - top - bottom);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="adminUsageChart">
      <fieldset className="adminSeriesPicker">
        <legend>{title}</legend>
        <button
          type="button"
          className="adminSeriesAction"
          onClick={() => setSelected([])}
          disabled={selected.length === 0}
        >
          {deselectAllLabel}
        </button>
        {(Object.keys(labels) as SeriesKey[]).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={() =>
                setSelected((current) =>
                  current.includes(key)
                    ? current.filter((item) => item !== key)
                    : [...current, key],
                )
              }
            />
            <span style={{ background: COLORS[key] }} aria-hidden="true" />
            {labels[key]}
          </label>
        ))}
      </fieldset>
      <div className="adminChartFrame" onMouseLeave={() => setHovered(undefined)}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className="adminChartGrid"
                x1={left}
                y1={y(tick)}
                x2={width - right}
                y2={y(tick)}
              />
              <text x={left - 8} y={y(tick) + 4} textAnchor="end">
                {tick}
              </text>
              <text x={width - right + 8} y={y(tick) + 4}>
                {tick}
              </text>
            </g>
          ))}
          {data.map((point, index) =>
            index % labelEvery === 0 || index === data.length - 1 ? (
              <text key={point.from} x={x(index)} y={height - 12} textAnchor="middle">
                {point.from.slice(5)}
              </text>
            ) : null,
          )}
          {selected.map((key) => (
            <polyline
              key={key}
              points={data.map((point, index) => `${x(index)},${y(point[key])}`).join(' ')}
              fill="none"
              stroke={COLORS[key]}
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hovered != null ? (
            <line
              className="adminHoverGuide"
              x1={x(hovered)}
              y1={top}
              x2={x(hovered)}
              y2={height - bottom}
            />
          ) : null}
          {data.map((point, index) => (
            <rect
              key={point.from}
              x={x(index) - Math.max(4, (width - left - right) / Math.max(data.length, 1) / 2)}
              y={top}
              width={Math.max(8, (width - left - right) / Math.max(data.length, 1))}
              height={height - top - bottom}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
            />
          ))}
        </svg>
        {hovered != null && data[hovered] ? (
          <div className="adminChartTooltip" style={{ left: `${(x(hovered) / width) * 100}%` }}>
            <strong>
              {data[hovered].from === data[hovered].to
                ? data[hovered].from
                : `${data[hovered].from} – ${data[hovered].to}`}
            </strong>
            {selected.map((key) => (
              <span key={key}>
                <i style={{ background: COLORS[key] }} />
                {labels[key]}: {data[hovered]![key]}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="adminTableWrap adminScrollBox">
        <table className="adminDataTable">
          <thead>
            <tr>
              <th>{periodLabel}</th>
              {selected.map((key) => (
                <th key={key}>{labels[key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.from}>
                <td>{point.from === point.to ? point.from : `${point.from} – ${point.to}`}</td>
                {selected.map((key) => (
                  <td key={key}>{point[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

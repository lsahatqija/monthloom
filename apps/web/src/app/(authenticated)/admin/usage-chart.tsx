'use client';

import type { AdminUsageResponse } from '@monthloom/contracts';
import { useState } from 'react';

type SeriesKey =
  | 'activeUsers'
  | 'activeHouseholds'
  | 'transactionsCreated'
  | 'transactionsUpdated'
  | 'transactionsDeleted'
  | 'registrations';

const COLORS: Record<SeriesKey, string> = {
  activeUsers: '#315c4c',
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
}: {
  data: AdminUsageResponse['series'];
  labels: Record<SeriesKey, string>;
  title: string;
  periodLabel: string;
}) {
  const [selected, setSelected] = useState<SeriesKey[]>(['activeUsers', 'transactionsCreated']);
  const width = 900;
  const height = 260;
  const padding = 28;
  const maximum = Math.max(1, ...data.flatMap((point) => selected.map((key) => point[key])));
  const x = (index: number) =>
    padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
  const y = (value: number) => height - padding - (value / maximum) * (height - padding * 2);

  function toggle(key: SeriesKey) {
    setSelected((current) => {
      if (current.includes(key))
        return current.length === 1 ? current : current.filter((item) => item !== key);
      return current.length >= 3 ? current : [...current, key];
    });
  }

  return (
    <div className="adminUsageChart">
      <fieldset className="adminSeriesPicker">
        <legend>{title}</legend>
        {(Object.keys(labels) as SeriesKey[]).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={selected.includes(key)}
              disabled={!selected.includes(key) && selected.length >= 3}
              onChange={() => toggle(key)}
            />
            <span style={{ background: COLORS[key] }} aria-hidden="true" />
            {labels[key]}
          </label>
        ))}
      </fieldset>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
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
      </svg>
      <div className="adminTableWrap">
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

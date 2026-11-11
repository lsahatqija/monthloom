'use client';

import type { AdminAdoptionResponse } from '@monthloom/contracts';
import { useState } from 'react';

export function AdoptionTrendChart({
  data,
  registrationsLabel,
}: {
  data: AdminAdoptionResponse['registrationSeries'];
  registrationsLabel: string;
}) {
  const [hovered, setHovered] = useState<number>();
  const width = 760,
    height = 280,
    left = 48,
    right = 18,
    top = 18,
    bottom = 42;
  const maximum = Math.max(1, ...data.map((point) => point.registrations));
  const roundedMaximum = Math.max(4, Math.ceil(maximum / 4) * 4);
  const ticks = Array.from({ length: 5 }, (_, index) => (roundedMaximum / 4) * index);
  const plotWidth = width - left - right,
    step = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.max(2, Math.min(28, step * 0.72));
  const y = (value: number) => height - bottom - (value / roundedMaximum) * (height - top - bottom);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div className="adminChartFrame adminChartBounded" onMouseLeave={() => setHovered(undefined)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={registrationsLabel}>
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
          </g>
        ))}
        {data.map((point, index) => {
          const x = left + index * step + (step - barWidth) / 2;
          return (
            <g key={point.from}>
              <rect
                className="adminChartBar"
                x={x}
                y={y(point.registrations)}
                width={barWidth}
                height={height - bottom - y(point.registrations)}
                onMouseEnter={() => setHovered(index)}
              />
              {index % labelEvery === 0 || index === data.length - 1 ? (
                <text x={x + barWidth / 2} y={height - 12} textAnchor="middle">
                  {point.from.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}
        {hovered != null ? (
          <line
            className="adminHoverGuide"
            x1={left + hovered * step + step / 2}
            y1={top}
            x2={left + hovered * step + step / 2}
            y2={height - bottom}
          />
        ) : null}
        {data.map((point, index) => (
          <rect
            key={`hover-${point.from}`}
            x={left + index * step}
            y={top}
            width={step}
            height={height - top - bottom}
            fill="transparent"
            onMouseEnter={() => setHovered(index)}
          />
        ))}
      </svg>
      {hovered != null && data[hovered] ? (
        <div
          className="adminChartTooltip"
          style={{ left: `${((left + hovered * step + step / 2) / width) * 100}%` }}
        >
          <strong>
            {data[hovered].from === data[hovered].to
              ? data[hovered].from
              : `${data[hovered].from} – ${data[hovered].to}`}
          </strong>
          <span>
            {registrationsLabel}: {data[hovered].registrations}
          </span>
        </div>
      ) : null}
    </div>
  );
}

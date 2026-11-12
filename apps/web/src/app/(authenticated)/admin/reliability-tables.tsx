'use client';

import type { AdminReliabilityResponse } from '@monthloom/contracts';
import { useMemo, useState } from 'react';

type Direction = 'ascending' | 'descending';
type SortState<T> = { key: keyof T; direction: Direction };

function sorted<T>(rows: T[], sort: SortState<T>): T[] {
  const direction = sort.direction === 'ascending' ? 1 : -1;
  return [...rows].sort(
    (left, right) =>
      String(left[sort.key]).localeCompare(String(right[sort.key]), undefined, { numeric: true }) *
      direction,
  );
}

function SortButton<T>({
  column,
  sort,
  onSort,
  children,
}: {
  column: keyof T;
  sort: SortState<T>;
  onSort: (column: keyof T) => void;
  children: string;
}) {
  return (
    <button type="button" className="adminSortButton" onClick={() => onSort(column)}>
      {children}
      {sort.key === column ? (sort.direction === 'ascending' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

export function ReliabilityTables({
  data,
  labels,
  locale,
}: {
  data: AdminReliabilityResponse;
  locale: string;
  labels: {
    routes: string;
    share: string;
    clientVersions: string;
    clientVersion: string;
    requests: string;
    errorRate: string;
    averageLatency: string;
    maximumLatency: string;
    period: string;
    errors: string;
    empty: string;
  };
}) {
  type Route = AdminReliabilityResponse['slowRoutes'][number];
  type Point = AdminReliabilityResponse['series'][number];
  const [routeSort, setRouteSort] = useState<SortState<Route>>({
    key: 'requests',
    direction: 'descending',
  });
  const [requestSort, setRequestSort] = useState<SortState<Point>>({
    key: 'from',
    direction: 'ascending',
  });
  const [hoveredRequest, setHoveredRequest] = useState<number>();
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale);
  const routes = useMemo(() => sorted(data.slowRoutes, routeSort), [data.slowRoutes, routeSort]);
  const requests = useMemo(() => sorted(data.series, requestSort), [data.series, requestSort]);
  const chart = { width: 760, height: 220, left: 42, right: 18, top: 18, bottom: 32 };
  const requestMaximum = Math.max(1, ...data.series.map((point) => point.requests));
  const chartX = (index: number) =>
    chart.left +
    (index * (chart.width - chart.left - chart.right)) / Math.max(data.series.length - 1, 1);
  const chartY = (value: number) =>
    chart.height -
    chart.bottom -
    (value / requestMaximum) * (chart.height - chart.top - chart.bottom);
  const deployments = data.deployment.history.filter(
    (deployment) =>
      deployment.deployedAt.slice(0, 10) >= data.range.from &&
      deployment.deployedAt.slice(0, 10) <= data.range.to,
  );
  const changeSort = <T,>(
    setSort: (value: SortState<T>) => void,
    current: SortState<T>,
    key: keyof T,
  ) =>
    setSort({
      key,
      direction:
        current.key === key && current.direction === 'ascending' ? 'descending' : 'ascending',
    });
  return (
    <>
      <section className="adminPanel" aria-labelledby="request-history">
        <div className="adminSectionHeading">
          <h2 id="request-history">{labels.requests}</h2>
          <span>
            {data.deployment.applicationVersion} ·{' '}
            {new Date(data.deployment.deployedAt).toLocaleDateString(locale)}
          </span>
        </div>
        <div
          className="adminChartFrame adminChartBounded"
          onMouseLeave={() => setHoveredRequest(undefined)}
        >
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="img"
            aria-label={labels.requests}
          >
            <line
              className="adminChartGrid"
              x1={chart.left}
              y1={chartY(0)}
              x2={chart.width - chart.right}
              y2={chartY(0)}
            />
            <polyline
              points={data.series
                .map((point, index) => `${chartX(index)},${chartY(point.requests)}`)
                .join(' ')}
              fill="none"
              stroke="var(--ml-primary)"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
            {hoveredRequest != null ? (
              <line
                className="adminHoverGuide"
                x1={chartX(hoveredRequest)}
                y1={chart.top}
                x2={chartX(hoveredRequest)}
                y2={chart.height - chart.bottom}
              />
            ) : null}
            {deployments.map((deployment) => {
              const date = deployment.deployedAt.slice(0, 10);
              const found = data.series.findIndex(
                (point) => point.from <= date && point.to >= date,
              );
              const x = chartX(Math.max(0, found));
              return (
                <g key={`${deployment.version}-${deployment.deployedAt}`}>
                  <line
                    className="adminDeploymentMarker"
                    x1={x}
                    y1={chart.top}
                    x2={x}
                    y2={chart.height - chart.bottom}
                  />
                  <text x={Math.min(x + 4, chart.width - 100)} y={chart.top + 10}>
                    {deployment.version} · {date}
                  </text>
                </g>
              );
            })}
            {data.series.map((point, index) =>
              index % Math.max(1, Math.ceil(data.series.length / 6)) === 0 ? (
                <text key={point.from} x={chartX(index)} y={chart.height - 8} textAnchor="middle">
                  {point.from.slice(5)}
                </text>
              ) : null,
            )}
            {data.series.map((point, index) => (
              <rect
                key={`hover-${point.from}`}
                x={
                  chartX(index) -
                  Math.max(
                    4,
                    (chart.width - chart.left - chart.right) / Math.max(data.series.length, 1) / 2,
                  )
                }
                y={chart.top}
                width={Math.max(
                  8,
                  (chart.width - chart.left - chart.right) / Math.max(data.series.length, 1),
                )}
                height={chart.height - chart.top - chart.bottom}
                fill="transparent"
                onMouseEnter={() => setHoveredRequest(index)}
              />
            ))}
          </svg>
          {hoveredRequest != null && data.series[hoveredRequest] ? (
            <div
              className="adminChartTooltip"
              style={{ left: `${(chartX(hoveredRequest) / chart.width) * 100}%` }}
            >
              <strong>
                {data.series[hoveredRequest].from === data.series[hoveredRequest].to
                  ? data.series[hoveredRequest].from
                  : `${data.series[hoveredRequest].from} – ${data.series[hoveredRequest].to}`}
              </strong>
              <span>
                {labels.requests}: {data.series[hoveredRequest].requests}
              </span>
              <span>
                {labels.errors}: {data.series[hoveredRequest].errors}
              </span>
            </div>
          ) : null}
        </div>
      </section>
      <section className="adminPanel" aria-labelledby="slow-routes">
        <div className="adminSectionHeading">
          <h2 id="slow-routes">{labels.routes}</h2>
        </div>
        {routes.length ? (
          <div className="adminTableWrap adminScrollBox">
            <table className="adminDataTable">
              <thead>
                <tr>
                  <th>
                    <SortButton
                      column="route"
                      sort={routeSort}
                      onSort={(key) => changeSort(setRouteSort, routeSort, key)}
                    >
                      {labels.routes}
                    </SortButton>
                  </th>
                  <th>
                    <SortButton
                      column="requests"
                      sort={routeSort}
                      onSort={(key) => changeSort(setRouteSort, routeSort, key)}
                    >
                      {labels.requests}
                    </SortButton>
                  </th>
                  <th>{labels.share}</th>
                  <th>
                    <SortButton
                      column="errorRate"
                      sort={routeSort}
                      onSort={(key) => changeSort(setRouteSort, routeSort, key)}
                    >
                      {labels.errorRate}
                    </SortButton>
                  </th>
                  <th>
                    <SortButton
                      column="averageLatencyMs"
                      sort={routeSort}
                      onSort={(key) => changeSort(setRouteSort, routeSort, key)}
                    >
                      {labels.averageLatency}
                    </SortButton>
                  </th>
                  <th>
                    <SortButton
                      column="maxLatencyMs"
                      sort={routeSort}
                      onSort={(key) => changeSort(setRouteSort, routeSort, key)}
                    >
                      {labels.maximumLatency}
                    </SortButton>
                  </th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => (
                  <tr key={`${route.method}-${route.route}`}>
                    <td>
                      {route.method} {route.route}
                    </td>
                    <td>{route.requests}</td>
                    <td>
                      {decimal.format(
                        data.summary.requests.current
                          ? (route.requests / data.summary.requests.current) * 100
                          : 0,
                      )}
                      %
                    </td>
                    <td>{decimal.format(route.errorRate)}%</td>
                    <td>{decimal.format(route.averageLatencyMs)} ms</td>
                    <td>{decimal.format(route.maxLatencyMs)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adminEmpty">{labels.empty}</p>
        )}
      </section>
      <section className="adminPanel" aria-labelledby="client-versions">
        <div className="adminSectionHeading">
          <h2 id="client-versions">{labels.clientVersions}</h2>
        </div>
        {data.deployment.clientVersions.length ? (
          <div className="adminTableWrap adminScrollBox">
            <table className="adminDataTable">
              <thead>
                <tr>
                  <th>{labels.clientVersion}</th>
                  <th>{labels.requests}</th>
                  <th>{labels.share}</th>
                </tr>
              </thead>
              <tbody>
                {data.deployment.clientVersions.map((client) => (
                  <tr key={client.version}>
                    <td>{client.version}</td>
                    <td>{integer.format(client.requests)}</td>
                    <td>
                      {decimal.format(
                        data.summary.requests.current
                          ? (client.requests / data.summary.requests.current) * 100
                          : 0,
                      )}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adminEmpty">{labels.empty}</p>
        )}
      </section>
      <section className="adminPanel" aria-labelledby="request-trend">
        <div className="adminSectionHeading">
          <h2 id="request-trend">{labels.requests}</h2>
        </div>
        <div className="adminTableWrap adminScrollBox">
          <table className="adminDataTable">
            <thead>
              <tr>
                <th>
                  <SortButton
                    column="from"
                    sort={requestSort}
                    onSort={(key) => changeSort(setRequestSort, requestSort, key)}
                  >
                    {labels.period}
                  </SortButton>
                </th>
                <th>
                  <SortButton
                    column="requests"
                    sort={requestSort}
                    onSort={(key) => changeSort(setRequestSort, requestSort, key)}
                  >
                    {labels.requests}
                  </SortButton>
                </th>
                <th>
                  <SortButton
                    column="errors"
                    sort={requestSort}
                    onSort={(key) => changeSort(setRequestSort, requestSort, key)}
                  >
                    {labels.errors}
                  </SortButton>
                </th>
                <th>
                  <SortButton
                    column="averageLatencyMs"
                    sort={requestSort}
                    onSort={(key) => changeSort(setRequestSort, requestSort, key)}
                  >
                    {labels.averageLatency}
                  </SortButton>
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((point) => (
                <tr key={point.from}>
                  <td>{point.from === point.to ? point.from : `${point.from} – ${point.to}`}</td>
                  <td>{point.requests}</td>
                  <td>{point.errors}</td>
                  <td>{decimal.format(point.averageLatencyMs)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

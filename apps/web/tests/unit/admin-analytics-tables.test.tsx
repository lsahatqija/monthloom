import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AdoptionTrendChart } from '../../src/app/(authenticated)/admin/adoption-trend-chart';
import { ReliabilityTables } from '../../src/app/(authenticated)/admin/reliability-tables';
import { UsageChart } from '../../src/app/(authenticated)/admin/usage-chart';

const labels = {
  activeUsers: 'Active users',
  dailyActiveUsers: 'DAU',
  weeklyActiveUsers: 'WAU',
  monthlyActiveUsers: 'MAU',
  activeHouseholds: 'Active households',
  transactionsCreated: 'Created',
  transactionsUpdated: 'Updated',
  transactionsDeleted: 'Deleted',
  registrations: 'Registrations',
};

describe('admin analytics tables', () => {
  it('allows every usage series and reveals values on hover', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <UsageChart
        title="Usage"
        periodLabel="Period"
        deselectAllLabel="Deselect all"
        labels={labels}
        data={[
          {
            from: '2026-11-01',
            to: '2026-11-01',
            activeUsers: 3,
            dailyActiveUsers: 3,
            weeklyActiveUsers: 5,
            monthlyActiveUsers: 8,
            activeHouseholds: 2,
            transactionsCreated: 4,
            transactionsUpdated: 1,
            transactionsDeleted: 0,
            registrations: 2,
          },
        ]}
      />,
    );
    for (const checkbox of screen.getAllByRole('checkbox'))
      if (!(checkbox as HTMLInputElement).checked) await user.click(checkbox);
    expect(screen.getAllByRole('checkbox')).toHaveLength(9);
    expect(
      screen.getAllByRole('checkbox').every((checkbox) => (checkbox as HTMLInputElement).checked),
    ).toBe(true);
    fireEvent.mouseEnter(container.querySelector('rect')!);
    expect(screen.getByText('WAU: 5')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Deselect all' }));
    expect(
      screen.getAllByRole('checkbox').every((checkbox) => !(checkbox as HTMLInputElement).checked),
    ).toBe(true);
  });

  it('shows a zero registration date when its chart column is hovered', () => {
    const { container } = render(
      <AdoptionTrendChart
        registrationsLabel="Registrations"
        data={[{ from: '2026-11-01', to: '2026-11-01', registrations: 0 }]}
      />,
    );
    fireEvent.mouseEnter(container.querySelector('rect[fill="transparent"]')!);
    expect(screen.getByText('Registrations: 0')).toBeVisible();
  });

  it('sorts reliability rows from their column headers', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ReliabilityTables
        locale="en"
        labels={{
          routes: 'Traffic by route',
          share: 'Traffic share',
          clientVersions: 'Traffic by client version',
          clientVersion: 'Client version',
          requests: 'Requests',
          errorRate: 'Error rate',
          averageLatency: 'Average latency',
          maximumLatency: 'Maximum latency',
          period: 'Period',
          errors: 'Errors',
          empty: 'Empty',
        }}
        data={
          {
            range: { from: '2026-11-01', to: '2026-11-02' },
            deployment: {
              applicationVersion: 'v2',
              deployedAt: '2026-11-02T00:00:00.000Z',
              history: [{ version: 'v2', deployedAt: '2026-11-02T00:00:00.000Z' }],
              clientVersions: [{ version: 'web-v2', requests: 8 }],
            },
            summary: { requests: { current: 9 } },
            slowRoutes: [
              {
                method: 'GET',
                route: '/fast',
                requests: 9,
                errorRate: 0,
                averageLatencyMs: 10,
                maxLatencyMs: 20,
              },
              {
                method: 'GET',
                route: '/slow',
                requests: 0,
                errorRate: 50,
                averageLatencyMs: 200,
                maxLatencyMs: 300,
              },
            ],
            series: [
              {
                from: '2026-11-01',
                to: '2026-11-01',
                requests: 0,
                errors: 0,
                averageLatencyMs: 10,
              },
              {
                from: '2026-11-02',
                to: '2026-11-02',
                requests: 8,
                errors: 1,
                averageLatencyMs: 20,
              },
            ],
          } as never
        }
      />,
    );
    fireEvent.mouseEnter(container.querySelector('svg rect')!);
    expect(screen.getByText('Requests: 0')).toBeVisible();
    const routeTable = screen.getAllByRole('table')[0]!;
    await user.click(within(routeTable).getByRole('button', { name: /Requests/ }));
    expect(within(routeTable).getAllByRole('row')[1]).toHaveTextContent('/slow');
    await user.click(within(routeTable).getByRole('button', { name: /Requests/ }));
    expect(within(routeTable).getAllByRole('row')[1]).toHaveTextContent('/fast');
    expect(screen.getByRole('heading', { name: 'Traffic by client version' })).toBeVisible();
    expect(screen.getByText('web-v2')).toBeVisible();
  });
});

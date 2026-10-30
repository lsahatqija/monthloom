import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  dashboardHrefFromGraph,
  graphHrefFromDashboard,
} from '../../src/features/finance/graph/selection-links';
import {
  readGraphSelection,
  useGraphSelection,
} from '../../src/features/finance/graph/use-graph-selection';

describe('graph URL selection', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, '', '/');
  });

  it('parses a valid custom period and safely normalizes invalid input', () => {
    expect(
      readGraphSelection(
        new URL(
          'https://monthloom.test/graph?household=home&period=custom-period&from=2026-01&to=2026-03',
        ),
        '2026-10',
      ),
    ).toMatchObject({
      householdId: 'home',
      period: 'custom-period',
      from: '2026-01',
      to: '2026-03',
    });
    expect(
      readGraphSelection(
        new URL('https://monthloom.test/graph?period=custom-period&from=2030-01&to=2020-01'),
        '2026-10',
      ),
    ).toMatchObject({
      period: 'custom-period',
      from: '2026-10',
      to: '2026-10',
      error: 'out-of-bounds',
    });
  });

  it('pushes valid changes and restores them through browser navigation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    window.history.replaceState({}, '', '/graph?household=home&period=current-month');
    const { result } = renderHook(() => useGraphSelection());

    act(() => result.current.setCustomPeriod('2026-01', '2026-03'));
    expect(window.location.search).toContain('period=custom-period');
    expect(result.current).toMatchObject({ from: '2026-01', to: '2026-03' });

    act(() => {
      window.history.pushState({}, '', '/graph?household=other&period=custom-month&month=2025-12');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(result.current.householdId).toBe('other'));
    expect(result.current).toMatchObject({
      period: 'custom-month',
      from: '2025-12',
      to: '2025-12',
    });
  });
});

describe('Home and Graphs selection links', () => {
  it('maps the current and custom dashboard months to Graphs', () => {
    expect(graphHrefFromDashboard('home', '2026-10', '2026-10')).toBe(
      '/graph?household=home&period=current-month',
    );
    expect(graphHrefFromDashboard('home', '2026-03', '2026-10')).toBe(
      '/graph?household=home&period=custom-month&month=2026-03',
    );
  });

  it('maps a single month back to Home and uses the current month for a range', () => {
    expect(
      dashboardHrefFromGraph({ householdId: 'home', from: '2026-03', to: '2026-03' }, '2026-10'),
    ).toBe('/?month=2026-03&household=home');
    expect(
      dashboardHrefFromGraph({ householdId: 'home', from: '2026-01', to: '2026-03' }, '2026-10'),
    ).toBe('/?month=2026-10&household=home');
  });
});

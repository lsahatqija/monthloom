import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useDashboardSelection } from '../../src/features/finance/dashboard/use-dashboard-selection';

describe('dashboard URL selection', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('restores the household and month from the URL on load and browser navigation', () => {
    window.history.replaceState({}, '', '/?household=second-home&month=2025-04');
    const { result } = renderHook(() => useDashboardSelection());

    expect(result.current.householdId).toBe('second-home');
    expect(result.current.month).toBe('2025-04');

    act(() => {
      window.history.pushState({}, '', '/?household=home&month=2026-02');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.householdId).toBe('home');
    expect(result.current.month).toBe('2026-02');
  });
});

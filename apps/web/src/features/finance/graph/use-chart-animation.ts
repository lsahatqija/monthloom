'use client';

import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function useChartAnimation(): boolean {
  const [enabled, setEnabled] = useState(
    () => typeof window === 'undefined' || !window.matchMedia?.(REDUCED_MOTION_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setEnabled(!query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return enabled;
}

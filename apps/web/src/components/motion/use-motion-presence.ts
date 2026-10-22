'use client';

import { useEffect, useRef, useState } from 'react';

export type MotionState = 'entered' | 'exiting';

export function useMotionPresence(open: boolean, exitDuration = 180) {
  const [mounted, setMounted] = useState(open);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;

    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 80
      : exitDuration;
    timeoutRef.current = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timeoutRef.current);
  }, [exitDuration, mounted, open]);

  const state: MotionState = open ? 'entered' : 'exiting';
  return {
    state,
    visible: open || mounted,
  };
}

'use client';

import { useEffect, useRef, useState } from 'react';

export type MotionState = 'entered' | 'exiting';

export function useMotionPresence(open: boolean, exitDuration = 180) {
  const [visible, setVisible] = useState(open);
  const [state, setState] = useState<MotionState>('entered');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    if (open) {
      setVisible(true);
      setState('entered');
      return;
    }
    if (!visible) return;

    setState('exiting');
    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 80
      : exitDuration;
    timeoutRef.current = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timeoutRef.current);
  }, [exitDuration, open, visible]);

  return { state, visible };
}

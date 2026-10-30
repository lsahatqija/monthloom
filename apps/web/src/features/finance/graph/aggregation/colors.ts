import type { DesiredColor } from '@monthloom/contracts';

import type { ChartStyle } from './types';

export type ChartTheme = 'light' | 'dark';

const PALETTES = {
  light: [
    '#2563eb',
    '#dc2626',
    '#047857',
    '#7c3aed',
    '#c2410c',
    '#0e7490',
    '#a21caf',
    '#4d7c0f',
    '#be123c',
    '#4338ca',
    '#0f766e',
    '#92400e',
  ],
  dark: [
    '#60a5fa',
    '#f87171',
    '#34d399',
    '#a78bfa',
    '#fb923c',
    '#22d3ee',
    '#e879f9',
    '#a3e635',
    '#fb7185',
    '#818cf8',
    '#2dd4bf',
    '#fbbf24',
  ],
} as const;

const USER_COLORS: Record<ChartTheme, Record<DesiredColor, string>> = {
  light: {
    slate: '#475569',
    red: '#dc2626',
    orange: '#c2410c',
    amber: '#a16207',
    yellow: '#854d0e',
    lime: '#4d7c0f',
    green: '#15803d',
    emerald: '#047857',
    teal: '#0f766e',
    cyan: '#0e7490',
    sky: '#0369a1',
    blue: '#1d4ed8',
    indigo: '#4338ca',
    violet: '#6d28d9',
    purple: '#7e22ce',
    rose: '#be123c',
  },
  dark: {
    slate: '#94a3b8',
    red: '#f87171',
    orange: '#fb923c',
    amber: '#fbbf24',
    yellow: '#fde047',
    lime: '#a3e635',
    green: '#4ade80',
    emerald: '#34d399',
    teal: '#2dd4bf',
    cyan: '#22d3ee',
    sky: '#38bdf8',
    blue: '#60a5fa',
    indigo: '#818cf8',
    violet: '#a78bfa',
    purple: '#d8b4fe',
    rose: '#fb7185',
  },
};

const PATTERNS = ['solid', 'diagonal', 'dots', 'crosshatch'] as const;

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function chartStyleForKey(
  key: string,
  theme: ChartTheme = 'light',
  desiredColor?: DesiredColor,
): ChartStyle {
  const value = hash(key);
  const palette = PALETTES[theme];
  return {
    color: desiredColor ? USER_COLORS[theme][desiredColor] : palette[value % palette.length]!,
    pattern: PATTERNS[Math.floor(value / palette.length) % PATTERNS.length]!,
  };
}

export const SEMANTIC_CHART_COLORS: Record<
  ChartTheme,
  Record<'income' | 'expense' | 'positiveBalance' | 'negativeBalance' | 'projected', string>
> = {
  light: {
    income: '#047857',
    expense: '#dc2626',
    positiveBalance: '#15803d',
    negativeBalance: '#b91c1c',
    projected: '#64748b',
  },
  dark: {
    income: '#34d399',
    expense: '#f87171',
    positiveBalance: '#4ade80',
    negativeBalance: '#fca5a5',
    projected: '#94a3b8',
  },
};

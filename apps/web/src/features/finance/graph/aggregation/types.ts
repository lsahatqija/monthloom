export interface ProjectionSplit {
  realizedCents: number;
  projectedCents: number;
  totalCents: number;
}

export interface BalanceValues {
  income: ProjectionSplit;
  expenses: ProjectionSplit;
  balance: ProjectionSplit;
}

export interface BalancePoint extends BalanceValues {
  date: string;
  anchor: boolean;
}

export interface BalanceViewModel {
  mode: 'daily' | 'cumulative';
  points: BalancePoint[];
  domain: readonly [number, number];
}

export type CategoryGrouping = 'user' | 'source' | 'transaction-type';

export interface ChartStyle {
  color: string;
  pattern: 'solid' | 'diagonal' | 'dots' | 'crosshatch';
}

export interface CategoryGroup extends ProjectionSplit, ChartStyle {
  key: string;
  label: string;
  percentage: number;
}

export interface CategoryViewModel {
  groups: CategoryGroup[];
  totalCents: number;
}

export type OverviewKind = 'expense' | 'income';
export type OverviewMode = 'combine' | 'compare';

export interface OverviewDimension {
  key: string;
  label: string;
}

export interface OverviewValue extends ProjectionSplit {
  dimensionKey: string;
  realizedNormalized: number;
  totalNormalized: number;
}

export interface OverviewSeries extends ChartStyle {
  key: string;
  label: string;
  values: OverviewValue[];
}

export interface OverviewViewModel {
  dimensions: OverviewDimension[];
  series: OverviewSeries[];
  selectedUserIds: string[];
  highestAmountCents: number;
}

export const financeKeys = {
  all: ['finance'] as const,
  households: () => [...financeKeys.all, 'households'] as const,
  primaryMonth: (month: string) => [...financeKeys.all, 'primary', month] as const,
  householdMonth: (householdId: string, month: string) =>
    [...financeKeys.all, 'household', householdId, month] as const,
  householdRanges: (householdId: string) =>
    [...financeKeys.all, 'household', householdId, 'range'] as const,
  householdRange: (householdId: string, from: string, to: string) =>
    [...financeKeys.householdRanges(householdId), from, to] as const,
  sources: (householdId: string) => [...financeKeys.all, 'sources', householdId] as const,
};

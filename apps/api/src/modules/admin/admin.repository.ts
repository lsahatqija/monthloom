export interface AdminMetrics {
  totalUsers: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  currentlyLoggedInUsers: number;
  households: number;
  incomes: number;
  expenses: number;
}

export interface AdminRepository {
  getMetrics(now: Date): Promise<AdminMetrics>;
  getUsage?(
    range: AdminResolvedRange,
    comparisonRange: AdminResolvedRange,
  ): Promise<Omit<AdminUsageResponse, 'generatedAt' | 'range' | 'comparisonRange'>>;
}
import type { AdminResolvedRange, AdminUsageResponse } from '@monthloom/contracts';

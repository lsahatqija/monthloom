import type {
  AdminAdoptionResponse,
  AdminResolvedRange,
  AdminReliabilityResponse,
  AdminRetentionResponse,
  AdminUsageResponse,
} from '@monthloom/contracts';

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
  getAdoption?(
    range: AdminResolvedRange,
    comparisonRange: AdminResolvedRange,
  ): Promise<Omit<AdminAdoptionResponse, 'generatedAt' | 'range' | 'comparisonRange'>>;
  getRetention?(
    range: AdminResolvedRange,
    comparisonRange: AdminResolvedRange,
  ): Promise<Omit<AdminRetentionResponse, 'generatedAt' | 'range' | 'comparisonRange'>>;
  getReliability?(
    range: AdminResolvedRange,
    comparisonRange: AdminResolvedRange,
  ): Promise<Omit<AdminReliabilityResponse, 'generatedAt' | 'range' | 'comparisonRange'>>;
}

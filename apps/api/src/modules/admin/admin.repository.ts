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
}

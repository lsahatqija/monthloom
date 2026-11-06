export interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  households: number;
  incomes: number;
  expenses: number;
}

export interface AdminRepository {
  getMetrics(now: Date): Promise<AdminMetrics>;
}

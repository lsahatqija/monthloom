import { and, count, countDistinct, gt, gte, isNull } from 'drizzle-orm';

import type { Database } from '../../../infrastructure/database/client.js';
import {
  expenses,
  households,
  incomes,
  sessions,
  users,
} from '../../../infrastructure/database/schema/index.js';
import type { AdminMetrics, AdminRepository } from '../admin.repository.js';

export class PostgresAdminRepository implements AdminRepository {
  constructor(private readonly db: Database) {}

  async getMetrics(now: Date): Promise<AdminMetrics> {
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
    const [
      [userCount],
      [dailyActiveUserCount],
      [weeklyActiveUserCount],
      [monthlyActiveUserCount],
      [currentlyLoggedInUserCount],
      [householdCount],
      [incomeCount],
      [expenseCount],
    ] = await Promise.all([
      this.db.select({ value: count() }).from(users),
      this.db.select({ value: count() }).from(users).where(gte(users.lastActiveAt, dayAgo)),
      this.db.select({ value: count() }).from(users).where(gte(users.lastActiveAt, weekAgo)),
      this.db.select({ value: count() }).from(users).where(gte(users.lastActiveAt, monthAgo)),
      this.db
        .select({ value: countDistinct(sessions.userId) })
        .from(sessions)
        .where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, now))),
      this.db.select({ value: count() }).from(households),
      this.db.select({ value: count() }).from(incomes),
      this.db.select({ value: count() }).from(expenses),
    ]);

    return {
      totalUsers: userCount?.value ?? 0,
      dailyActiveUsers: dailyActiveUserCount?.value ?? 0,
      weeklyActiveUsers: weeklyActiveUserCount?.value ?? 0,
      monthlyActiveUsers: monthlyActiveUserCount?.value ?? 0,
      currentlyLoggedInUsers: currentlyLoggedInUserCount?.value ?? 0,
      households: householdCount?.value ?? 0,
      incomes: incomeCount?.value ?? 0,
      expenses: expenseCount?.value ?? 0,
    };
  }
}

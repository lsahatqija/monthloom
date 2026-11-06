import { and, count, countDistinct, gt, isNull } from 'drizzle-orm';

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
    const [[userCount], [activeUserCount], [householdCount], [incomeCount], [expenseCount]] =
      await Promise.all([
        this.db.select({ value: count() }).from(users),
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
      activeUsers: activeUserCount?.value ?? 0,
      households: householdCount?.value ?? 0,
      incomes: incomeCount?.value ?? 0,
      expenses: expenseCount?.value ?? 0,
    };
  }
}

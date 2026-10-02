import type { HouseholdMonthResponse, HouseholdTransaction } from '@template/contracts';
import { and, asc, eq, gte, lt } from 'drizzle-orm';

import type { Database } from '../../../infrastructure/database/client.js';
import {
  expenses,
  householdMembers,
  households,
  incomes,
  sources,
  users,
} from '../../../infrastructure/database/schema.js';
import type { FinanceRepository } from '../finance.repository.js';
import type { HouseholdRecord } from '../finance.types.js';

function toHousehold(record: typeof households.$inferSelect): HouseholdRecord {
  return {
    id: record.id,
    name: record.name,
    currency: record.currency,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function monthEnd(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year!, monthNumber!, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export class PostgresFinanceRepository implements FinanceRepository {
  constructor(private readonly db: Database) {}

  async createDefaultHousehold(userId: string, displayName: string): Promise<HouseholdRecord> {
    return this.db.transaction(async (transaction) => {
      const [record] = await transaction
        .insert(households)
        .values({ name: `${displayName}'s Household`, currency: 'EUR' })
        .returning();

      if (!record) throw new Error('Failed to create household.');

      await transaction
        .insert(householdMembers)
        .values({ householdId: record.id, userId, isPrimary: true });
      return toHousehold(record);
    });
  }

  async findPrimaryHousehold(userId: string): Promise<HouseholdRecord | null> {
    const [record] = await this.db
      .select({ household: households })
      .from(householdMembers)
      .innerJoin(households, eq(householdMembers.householdId, households.id))
      .where(and(eq(householdMembers.userId, userId), eq(householdMembers.isPrimary, true)))
      .orderBy(asc(householdMembers.joinedAt), asc(households.createdAt), asc(households.id))
      .limit(1);
    return record ? toHousehold(record.household) : null;
  }

  async getMonth(
    householdId: string,
    month: string,
  ): Promise<HouseholdMonthResponse['transactions']> {
    const start = `${month}-01`;
    const end = monthEnd(month);
    const selection = {
      id: incomes.id,
      date: incomes.date,
      icon: incomes.icon,
      color: incomes.color,
      amount: incomes.amount,
      userId: users.id,
      userDisplayName: users.displayName,
      userProfileImage: users.profileImage,
      userDesiredColor: users.desiredColor,
      sourceId: sources.id,
      sourceDisplayName: sources.displayName,
    };

    const incomeRows = await this.db
      .select(selection)
      .from(incomes)
      .innerJoin(users, eq(incomes.userId, users.id))
      .innerJoin(sources, eq(incomes.sourceId, sources.id))
      .where(
        and(eq(incomes.householdId, householdId), gte(incomes.date, start), lt(incomes.date, end)),
      );

    const expenseRows = await this.db
      .select({
        ...selection,
        id: expenses.id,
        date: expenses.date,
        icon: expenses.icon,
        color: expenses.color,
        amount: expenses.amount,
      })
      .from(expenses)
      .innerJoin(users, eq(expenses.userId, users.id))
      .innerJoin(sources, eq(expenses.sourceId, sources.id))
      .where(
        and(
          eq(expenses.householdId, householdId),
          gte(expenses.date, start),
          lt(expenses.date, end),
        ),
      );

    const mapRow = (
      row: (typeof incomeRows)[number],
      kind: HouseholdTransaction['kind'],
    ): HouseholdTransaction => ({
      id: row.id,
      kind,
      date: row.date,
      icon: row.icon,
      color: row.color,
      amount: row.amount,
      user: {
        id: row.userId,
        displayName: row.userDisplayName,
        profileImage: row.userProfileImage,
        desiredColor: row.userDesiredColor,
      },
      source: { id: row.sourceId, displayName: row.sourceDisplayName },
    });

    return [
      ...incomeRows.map((row) => mapRow(row, 'income')),
      ...expenseRows.map((row) => mapRow(row, 'expense')),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }

  async isMember(householdId: string, userId: string): Promise<boolean> {
    const [record] = await this.db
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(
        and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)),
      )
      .limit(1);
    return Boolean(record);
  }

  async updateHouseholdName(householdId: string, name: string): Promise<HouseholdRecord> {
    const [record] = await this.db
      .update(households)
      .set({ name, updatedAt: new Date() })
      .where(eq(households.id, householdId))
      .returning();
    if (!record) throw new Error('Failed to update household: not found.');
    return toHousehold(record);
  }
}

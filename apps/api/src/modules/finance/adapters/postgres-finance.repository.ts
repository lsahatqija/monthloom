import { randomUUID } from 'node:crypto';

import type {
  CreateHouseholdTransactionRequest,
  CreateHouseholdRequest,
  HouseholdMonthResponse,
  HouseholdTransaction,
  TransactionEditScope,
  UpdateHouseholdRequest,
  UpdateHouseholdTransactionRequest,
} from '@template/contracts';
import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm';

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
import type { HouseholdRecord, ManagedHouseholdRecord } from '../finance.types.js';

function toHousehold(record: typeof households.$inferSelect): HouseholdRecord {
  return {
    id: record.id,
    name: record.name,
    currency: record.currency,
    icon: record.icon,
    color: record.color,
    ownerId: record.ownerId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function monthEnd(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year!, monthNumber!, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function alignOccurrenceDate(existingDate: string, editedDate: string): string {
  const [year, month] = existingDate.split('-').map(Number);
  const requestedDay = Number(editedDate.slice(8, 10));
  const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return `${existingDate.slice(0, 8)}${String(Math.min(requestedDay, lastDay)).padStart(2, '0')}`;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function averageAmounts(amounts: string[]): string {
  const totalCents = amounts.reduce((total, amount) => {
    const [whole, fraction = ''] = amount.split('.');
    return total + Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  }, 0);
  return (Math.round(totalCents / amounts.length) / 100).toFixed(2);
}

export class PostgresFinanceRepository implements FinanceRepository {
  constructor(private readonly db: Database) {}

  async createHousehold(userId: string, input: CreateHouseholdRequest): Promise<HouseholdRecord> {
    return this.db.transaction(async (transaction) => {
      const [existingMembership] = await transaction
        .select({ householdId: householdMembers.householdId })
        .from(householdMembers)
        .where(eq(householdMembers.userId, userId))
        .limit(1);
      const [record] = await transaction
        .insert(households)
        .values({ ...input, ownerId: userId, currency: 'EUR' })
        .returning();

      if (!record) throw new Error('Failed to create household.');

      await transaction
        .insert(householdMembers)
        .values({ householdId: record.id, userId, isPrimary: !existingMembership });
      return toHousehold(record);
    });
  }

  async listHouseholds(userId: string): Promise<ManagedHouseholdRecord[]> {
    const memberships = await this.db
      .select({ household: households, isPrimary: householdMembers.isPrimary })
      .from(householdMembers)
      .innerJoin(households, eq(householdMembers.householdId, households.id))
      .where(eq(householdMembers.userId, userId))
      .orderBy(asc(households.name), asc(households.id));
    if (!memberships.length) return [];

    const householdIds = memberships.map(({ household }) => household.id);
    const members = await this.db
      .select({
        householdId: householdMembers.householdId,
        joinedAt: householdMembers.joinedAt,
        id: users.id,
        displayName: users.displayName,
        profileImage: users.profileImage,
        desiredColor: users.desiredColor,
      })
      .from(householdMembers)
      .innerJoin(users, eq(householdMembers.userId, users.id))
      .where(inArray(householdMembers.householdId, householdIds))
      .orderBy(asc(householdMembers.joinedAt), asc(users.displayName));

    return memberships.map(({ household, isPrimary }) => ({
      ...toHousehold(household),
      isPrimary,
      members: members
        .filter((member) => member.householdId === household.id)
        .map(({ householdId: _householdId, ...member }) => member),
    }));
  }

  async findHousehold(householdId: string): Promise<HouseholdRecord | null> {
    const [record] = await this.db
      .select()
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);
    return record ? toHousehold(record) : null;
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
      recurring: incomes.recurring,
      expiresOn: incomes.expiresOn,
      recurrenceId: incomes.recurrenceId,
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
        type: expenses.type,
        date: expenses.date,
        icon: expenses.icon,
        color: expenses.color,
        amount: expenses.amount,
        recurring: expenses.recurring,
        expiresOn: expenses.expiresOn,
        recurrenceId: expenses.recurrenceId,
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
      type: null,
      date: row.date,
      icon: row.icon,
      color: row.color,
      amount: row.amount,
      recurring: row.recurring,
      expiresOn: row.expiresOn,
      projected: false,
      user: {
        id: row.userId,
        displayName: row.userDisplayName,
        profileImage: row.userProfileImage,
        desiredColor: row.userDesiredColor,
      },
      source: { id: row.sourceId, displayName: row.sourceDisplayName },
    });

    const actualTransactions = [
      ...incomeRows.map((row) => mapRow(row, 'income')),
      ...expenseRows.map((row) => ({ ...mapRow(row, 'expense'), type: row.type })),
    ];

    if (month <= currentMonth()) {
      return actualTransactions.sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
      );
    }

    const recurringIncomeRows = await this.db
      .select(selection)
      .from(incomes)
      .innerJoin(users, eq(incomes.userId, users.id))
      .innerJoin(sources, eq(incomes.sourceId, sources.id))
      .where(
        and(
          eq(incomes.householdId, householdId),
          eq(incomes.recurring, true),
          lt(incomes.date, start),
        ),
      );
    const recurringExpenseRows = await this.db
      .select({
        ...selection,
        id: expenses.id,
        type: expenses.type,
        date: expenses.date,
        icon: expenses.icon,
        color: expenses.color,
        amount: expenses.amount,
        recurring: expenses.recurring,
        expiresOn: expenses.expiresOn,
        recurrenceId: expenses.recurrenceId,
      })
      .from(expenses)
      .innerJoin(users, eq(expenses.userId, users.id))
      .innerJoin(sources, eq(expenses.sourceId, sources.id))
      .where(
        and(
          eq(expenses.householdId, householdId),
          eq(expenses.recurring, true),
          lt(expenses.date, start),
        ),
      );
    const history = [
      ...recurringIncomeRows.map((row) => ({ ...row, kind: 'income' as const, type: null })),
      ...recurringExpenseRows.map((row) => ({ ...row, kind: 'expense' as const })),
    ];
    const historiesBySeries = new Map<string, typeof history>();
    for (const row of history) {
      if (!row.recurrenceId) continue;
      const series = historiesBySeries.get(row.recurrenceId) ?? [];
      series.push(row);
      historiesBySeries.set(row.recurrenceId, series);
    }
    const actualSeries = new Set(
      [...incomeRows, ...expenseRows]
        .map((row) => row.recurrenceId)
        .filter((recurrenceId): recurrenceId is string => Boolean(recurrenceId)),
    );
    const projectedTransactions: HouseholdTransaction[] = [];
    for (const [recurrenceId, series] of historiesBySeries) {
      if (actualSeries.has(recurrenceId)) continue;
      series.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
      const latest = series[0]!;
      const projectedDate = alignOccurrenceDate(`${month}-01`, latest.date);
      if (latest.expiresOn && projectedDate > latest.expiresOn) continue;
      projectedTransactions.push({
        id: latest.id,
        kind: latest.kind,
        type: latest.type,
        date: projectedDate,
        icon: latest.icon,
        color: latest.color,
        amount: averageAmounts(series.slice(0, 6).map((row) => row.amount)),
        recurring: true,
        expiresOn: latest.expiresOn,
        projected: true,
        user: {
          id: latest.userId,
          displayName: latest.userDisplayName,
          profileImage: latest.userProfileImage,
          desiredColor: latest.userDesiredColor,
        },
        source: { id: latest.sourceId, displayName: latest.sourceDisplayName },
      });
    }

    return [...actualTransactions, ...projectedTransactions].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
  }

  async getMembers(householdId: string): Promise<HouseholdMonthResponse['members']> {
    return this.db
      .select({
        id: users.id,
        displayName: users.displayName,
        profileImage: users.profileImage,
        desiredColor: users.desiredColor,
      })
      .from(householdMembers)
      .innerJoin(users, eq(householdMembers.userId, users.id))
      .where(eq(householdMembers.householdId, householdId))
      .orderBy(asc(users.displayName), asc(users.id));
  }

  async getSources(householdId: string): Promise<HouseholdMonthResponse['sources']> {
    return this.db
      .select({ id: sources.id, displayName: sources.displayName })
      .from(sources)
      .where(eq(sources.householdId, householdId))
      .orderBy(asc(sources.displayName), asc(sources.id));
  }

  async createTransaction(
    householdId: string,
    input: CreateHouseholdTransactionRequest,
  ): Promise<HouseholdTransaction> {
    return this.db.transaction(async (transaction) => {
      const nameKey = input.source.trim().toLocaleLowerCase('en-US');
      const [source] = await transaction
        .insert(sources)
        .values({ householdId, displayName: input.source, nameKey })
        .onConflictDoUpdate({
          target: [sources.householdId, sources.nameKey],
          set: { displayName: input.source, updatedAt: new Date() },
        })
        .returning({ id: sources.id, displayName: sources.displayName });

      if (!source) throw new Error('Failed to resolve transaction source.');

      const values = {
        householdId,
        sourceId: source.id,
        userId: input.userId,
        icon: input.icon,
        color: input.color,
        amount: input.amount,
        date: input.date,
        recurring: input.recurring,
        expiresOn: input.recurring ? input.expiresOn : null,
        recurrenceId: input.recurring ? randomUUID() : null,
      };
      const [record] =
        input.kind === 'income'
          ? await transaction.insert(incomes).values(values).returning()
          : await transaction
              .insert(expenses)
              .values({ ...values, type: input.type! })
              .returning();
      if (!record) throw new Error('Failed to create transaction.');

      const [user] = await transaction
        .select({
          id: users.id,
          displayName: users.displayName,
          profileImage: users.profileImage,
          desiredColor: users.desiredColor,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!user) throw new Error('Failed to load transaction user.');

      return {
        id: record.id,
        kind: input.kind,
        type: input.kind === 'expense' ? input.type : null,
        date: record.date,
        icon: record.icon,
        color: record.color,
        amount: record.amount,
        recurring: record.recurring,
        expiresOn: record.expiresOn,
        projected: false,
        user,
        source,
      };
    });
  }

  async updateTransaction(
    householdId: string,
    transactionId: string,
    input: UpdateHouseholdTransactionRequest,
  ): Promise<HouseholdTransaction | null> {
    return this.db.transaction(async (transaction) => {
      const selectedFields = {
        id: incomes.id,
        date: incomes.date,
        recurrenceId: incomes.recurrenceId,
      };
      const [income] = await transaction
        .select(selectedFields)
        .from(incomes)
        .where(and(eq(incomes.householdId, householdId), eq(incomes.id, transactionId)))
        .limit(1);
      const [expense] = income
        ? []
        : await transaction
            .select({
              id: expenses.id,
              date: expenses.date,
              recurrenceId: expenses.recurrenceId,
            })
            .from(expenses)
            .where(and(eq(expenses.householdId, householdId), eq(expenses.id, transactionId)))
            .limit(1);
      const original = income ?? expense;
      if (!original) return null;

      const originalKind: HouseholdTransaction['kind'] = income ? 'income' : 'expense';
      let occurrences = [original];
      if (original.recurrenceId) {
        occurrences = income
          ? await transaction
              .select(selectedFields)
              .from(incomes)
              .where(
                and(
                  eq(incomes.householdId, householdId),
                  eq(incomes.recurrenceId, original.recurrenceId),
                ),
              )
          : await transaction
              .select({
                id: expenses.id,
                date: expenses.date,
                recurrenceId: expenses.recurrenceId,
              })
              .from(expenses)
              .where(
                and(
                  eq(expenses.householdId, householdId),
                  eq(expenses.recurrenceId, original.recurrenceId),
                ),
              );
      }
      occurrences = occurrences.filter((occurrence) => {
        if (occurrence.id === transactionId) return input.selection.current;
        if (occurrence.date < original.date) return input.selection.past;
        if (occurrence.date > original.date) return input.selection.future;
        return false;
      });

      const nameKey = input.transaction.source.trim().toLocaleLowerCase('en-US');
      const [source] = await transaction
        .insert(sources)
        .values({
          householdId,
          displayName: input.transaction.source,
          nameKey,
        })
        .onConflictDoUpdate({
          target: [sources.householdId, sources.nameKey],
          set: { displayName: input.transaction.source, updatedAt: new Date() },
        })
        .returning({ id: sources.id, displayName: sources.displayName });
      if (!source) throw new Error('Failed to resolve transaction source.');

      const recurrenceId = input.transaction.recurring
        ? (original.recurrenceId ?? randomUUID())
        : null;
      for (const occurrence of occurrences) {
        const values = {
          householdId,
          sourceId: source.id,
          userId: input.transaction.userId,
          icon: input.transaction.icon,
          color: input.transaction.color,
          amount: input.transaction.amount,
          date:
            occurrence.id === transactionId
              ? input.transaction.date
              : alignOccurrenceDate(occurrence.date, input.transaction.date),
          recurring: input.transaction.recurring,
          expiresOn: input.transaction.recurring ? input.transaction.expiresOn : null,
          recurrenceId,
          updatedAt: new Date(),
        };

        if (input.transaction.kind === originalKind) {
          if (originalKind === 'income') {
            await transaction.update(incomes).set(values).where(eq(incomes.id, occurrence.id));
          } else {
            await transaction
              .update(expenses)
              .set({ ...values, type: input.transaction.type! })
              .where(eq(expenses.id, occurrence.id));
          }
        } else if (input.transaction.kind === 'income') {
          await transaction.insert(incomes).values({ id: occurrence.id, ...values });
          await transaction.delete(expenses).where(eq(expenses.id, occurrence.id));
        } else {
          await transaction
            .insert(expenses)
            .values({ id: occurrence.id, ...values, type: input.transaction.type! });
          await transaction.delete(incomes).where(eq(incomes.id, occurrence.id));
        }
      }

      const [user] = await transaction
        .select({
          id: users.id,
          displayName: users.displayName,
          profileImage: users.profileImage,
          desiredColor: users.desiredColor,
        })
        .from(users)
        .where(eq(users.id, input.transaction.userId))
        .limit(1);
      if (!user) throw new Error('Failed to load transaction user.');

      return {
        id: transactionId,
        kind: input.transaction.kind,
        type: input.transaction.kind === 'expense' ? input.transaction.type : null,
        date: input.transaction.date,
        icon: input.transaction.icon,
        color: input.transaction.color,
        amount: input.transaction.amount,
        recurring: input.transaction.recurring,
        expiresOn: input.transaction.recurring ? input.transaction.expiresOn : null,
        projected: false,
        user,
        source,
      };
    });
  }

  async removeTransaction(
    householdId: string,
    transactionId: string,
    scope: TransactionEditScope,
  ): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      const [income] = await transaction
        .select({ id: incomes.id, date: incomes.date, recurrenceId: incomes.recurrenceId })
        .from(incomes)
        .where(and(eq(incomes.householdId, householdId), eq(incomes.id, transactionId)))
        .limit(1);
      const [expense] = income
        ? []
        : await transaction
            .select({ id: expenses.id, date: expenses.date, recurrenceId: expenses.recurrenceId })
            .from(expenses)
            .where(and(eq(expenses.householdId, householdId), eq(expenses.id, transactionId)))
            .limit(1);
      const original = income ?? expense;
      if (!original) return false;

      if (income) {
        await transaction
          .delete(incomes)
          .where(
            scope === 'current' || !original.recurrenceId
              ? and(eq(incomes.householdId, householdId), eq(incomes.id, transactionId))
              : and(
                  eq(incomes.householdId, householdId),
                  eq(incomes.recurrenceId, original.recurrenceId),
                  scope === 'current_and_future' ? gte(incomes.date, original.date) : undefined,
                ),
          );
      } else {
        await transaction
          .delete(expenses)
          .where(
            scope === 'current' || !original.recurrenceId
              ? and(eq(expenses.householdId, householdId), eq(expenses.id, transactionId))
              : and(
                  eq(expenses.householdId, householdId),
                  eq(expenses.recurrenceId, original.recurrenceId),
                  scope === 'current_and_future' ? gte(expenses.date, original.date) : undefined,
                ),
          );
      }
      return true;
    });
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

  async updateHousehold(
    householdId: string,
    input: UpdateHouseholdRequest,
  ): Promise<HouseholdRecord> {
    const [record] = await this.db
      .update(households)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(households.id, householdId))
      .returning();
    if (!record) throw new Error('Failed to update household: not found.');
    return toHousehold(record);
  }

  async setPrimaryHousehold(householdId: string, userId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction
        .update(householdMembers)
        .set({ isPrimary: false })
        .where(eq(householdMembers.userId, userId));
      await transaction
        .update(householdMembers)
        .set({ isPrimary: true })
        .where(
          and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)),
        );
    });
  }

  async removeMember(householdId: string, userId: string): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      const [removed] = await transaction
        .delete(householdMembers)
        .where(
          and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)),
        )
        .returning({ isPrimary: householdMembers.isPrimary });
      if (!removed) return false;
      if (removed.isPrimary) {
        const [replacement] = await transaction
          .select({ householdId: householdMembers.householdId })
          .from(householdMembers)
          .where(eq(householdMembers.userId, userId))
          .orderBy(asc(householdMembers.joinedAt), asc(householdMembers.householdId))
          .limit(1);
        if (replacement) {
          await transaction
            .update(householdMembers)
            .set({ isPrimary: true })
            .where(
              and(
                eq(householdMembers.householdId, replacement.householdId),
                eq(householdMembers.userId, userId),
              ),
            );
        }
      }
      return true;
    });
  }

  async leaveHousehold(householdId: string, userId: string, newOwnerId?: string): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      if (newOwnerId) {
        await transaction
          .update(households)
          .set({ ownerId: newOwnerId, updatedAt: new Date() })
          .where(and(eq(households.id, householdId), eq(households.ownerId, userId)));
      }
      const [removed] = await transaction
        .delete(householdMembers)
        .where(
          and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)),
        )
        .returning({ isPrimary: householdMembers.isPrimary });
      if (!removed) return false;
      if (removed.isPrimary) {
        const [replacement] = await transaction
          .select({ householdId: householdMembers.householdId })
          .from(householdMembers)
          .where(eq(householdMembers.userId, userId))
          .orderBy(asc(householdMembers.joinedAt), asc(householdMembers.householdId))
          .limit(1);
        if (replacement) {
          await transaction
            .update(householdMembers)
            .set({ isPrimary: true })
            .where(
              and(
                eq(householdMembers.householdId, replacement.householdId),
                eq(householdMembers.userId, userId),
              ),
            );
        }
      }
      return true;
    });
  }

  async deleteHousehold(householdId: string): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      const primaryMembers = await transaction
        .select({ userId: householdMembers.userId })
        .from(householdMembers)
        .where(
          and(eq(householdMembers.householdId, householdId), eq(householdMembers.isPrimary, true)),
        );
      const [deleted] = await transaction
        .delete(households)
        .where(eq(households.id, householdId))
        .returning({ id: households.id });
      if (!deleted) return false;
      for (const { userId } of primaryMembers) {
        const [replacement] = await transaction
          .select({ householdId: householdMembers.householdId })
          .from(householdMembers)
          .where(eq(householdMembers.userId, userId))
          .orderBy(asc(householdMembers.joinedAt), asc(householdMembers.householdId))
          .limit(1);
        if (replacement) {
          await transaction
            .update(householdMembers)
            .set({ isPrimary: true })
            .where(
              and(
                eq(householdMembers.householdId, replacement.householdId),
                eq(householdMembers.userId, userId),
              ),
            );
        }
      }
      return true;
    });
  }
}

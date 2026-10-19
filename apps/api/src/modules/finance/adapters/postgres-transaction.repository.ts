import { randomUUID } from 'node:crypto';

import type {
  CreateHouseholdTransactionRequest,
  HouseholdMonthResponse,
  HouseholdTransaction,
  TransactionEditScope,
  UpdateHouseholdTransactionRequest,
} from '@monthloom/contracts';
import { and, eq, gte, lt } from 'drizzle-orm';

import type { Database } from '../../../infrastructure/database/client.js';
import {
  expenses,
  incomes,
  sources,
  users,
} from '../../../infrastructure/database/schema/index.js';
import type { TransactionRepository } from '../finance.repository.js';
import type { ExpenseType } from '../finance.types.js';
import {
  alignOccurrenceDate,
  currentMonth,
  monthEnd,
  recurringOccurrenceDates,
} from '../rules/dates.js';
import { averageAmounts } from '../rules/money.js';

export class PostgresTransactionRepository implements TransactionRepository {
  constructor(private readonly db: Database) {}

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
      sourceKey: sources.key,
      sourceAliases: sources.aliases,
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
      type: 'income',
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
      source: {
        id: row.sourceId,
        displayName: row.sourceDisplayName,
        key: row.sourceKey,
        aliases: row.sourceAliases,
      },
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
      ...recurringIncomeRows.map((row) => ({
        ...row,
        kind: 'income' as const,
        type: 'income' as const,
      })),
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
        source: {
          id: latest.sourceId,
          displayName: latest.sourceDisplayName,
          key: latest.sourceKey,
          aliases: latest.sourceAliases,
        },
      });
    }

    return [...actualTransactions, ...projectedTransactions].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
  }

  async createTransaction(
    householdId: string,
    input: CreateHouseholdTransactionRequest,
  ): Promise<HouseholdTransaction> {
    return this.db.transaction(async (transaction) => {
      const [source] = await transaction
        .select({
          id: sources.id,
          displayName: sources.displayName,
          key: sources.key,
          aliases: sources.aliases,
        })
        .from(sources)
        .where(and(eq(sources.householdId, householdId), eq(sources.id, input.sourceId)))
        .limit(1);

      if (!source) throw new Error('Transaction source does not belong to the household.');

      const recurrenceId = input.recurring ? randomUUID() : null;
      const occurrenceDates =
        input.recurring && input.date.slice(0, 7) < currentMonth()
          ? recurringOccurrenceDates(input.date, currentMonth(), input.expiresOn)
          : [input.date];
      const values = {
        householdId,
        sourceId: source.id,
        userId: input.userId,
        icon: input.icon,
        color: input.color,
        amount: input.amount,
        recurring: input.recurring,
        expiresOn: input.recurring ? input.expiresOn : null,
        recurrenceId,
      };
      const records =
        input.kind === 'income'
          ? await transaction
              .insert(incomes)
              .values(occurrenceDates.map((date) => ({ ...values, date })))
              .returning()
          : await transaction
              .insert(expenses)
              .values(
                occurrenceDates.map((date) => ({
                  ...values,
                  date,
                  type: input.type as ExpenseType,
                })),
              )
              .returning();
      const record = records.find(({ date }) => date === input.date);
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
        type: input.kind === 'expense' ? input.type : 'income',
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

      const [source] = await transaction
        .select({
          id: sources.id,
          displayName: sources.displayName,
          key: sources.key,
          aliases: sources.aliases,
        })
        .from(sources)
        .where(
          and(eq(sources.householdId, householdId), eq(sources.id, input.transaction.sourceId)),
        )
        .limit(1);
      if (!source) throw new Error('Transaction source does not belong to the household.');

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
              .set({ ...values, type: input.transaction.type as ExpenseType })
              .where(eq(expenses.id, occurrence.id));
          }
        } else if (input.transaction.kind === 'income') {
          await transaction.insert(incomes).values({ id: occurrence.id, ...values });
          await transaction.delete(expenses).where(eq(expenses.id, occurrence.id));
        } else {
          await transaction.insert(expenses).values({
            id: occurrence.id,
            ...values,
            type: input.transaction.type as ExpenseType,
          });
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
        type: input.transaction.kind === 'expense' ? input.transaction.type : 'income',
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
}

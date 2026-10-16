import type {
  CopyHouseholdSourcesResponse,
  CreateHouseholdSourceRequest,
  HouseholdMonthResponse,
  HouseholdSource,
  UpdateHouseholdSourceRequest,
} from '@monthloom/contracts';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';

import type { Database } from '../../../infrastructure/database/client.js';
import { expenses, incomes, sources } from '../../../infrastructure/database/schema/index.js';
import type { SourceRepository } from '../finance.repository.js';
import { sourceValues } from '../rules/sources.js';

export class PostgresSourceRepository implements SourceRepository {
  constructor(private readonly db: Database) {}

  async getSources(householdId: string): Promise<HouseholdMonthResponse['sources']> {
    return this.db
      .select({
        id: sources.id,
        displayName: sources.displayName,
        key: sources.key,
        aliases: sources.aliases,
      })
      .from(sources)
      .where(eq(sources.householdId, householdId))
      .orderBy(asc(sources.displayName), asc(sources.id));
  }

  async getSource(householdId: string, sourceId: string): Promise<HouseholdSource | null> {
    const [source] = await this.db
      .select({
        id: sources.id,
        displayName: sources.displayName,
        key: sources.key,
        aliases: sources.aliases,
      })
      .from(sources)
      .where(and(eq(sources.householdId, householdId), eq(sources.id, sourceId)))
      .limit(1);
    return source ?? null;
  }

  async createSource(
    householdId: string,
    input: CreateHouseholdSourceRequest,
  ): Promise<HouseholdSource | null> {
    const values = sourceValues(input.displayName, input.aliases);
    const [source] = await this.db
      .insert(sources)
      .values({ householdId, ...values })
      .onConflictDoNothing({ target: [sources.householdId, sources.key] })
      .returning({
        id: sources.id,
        displayName: sources.displayName,
        key: sources.key,
        aliases: sources.aliases,
      });
    return source ?? null;
  }

  async updateSource(
    householdId: string,
    sourceId: string,
    input: UpdateHouseholdSourceRequest,
  ): Promise<HouseholdSource | 'not_found' | 'conflict'> {
    return this.db.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.householdId, householdId), eq(sources.id, sourceId)))
        .limit(1);
      if (!existing) return 'not_found';

      const values = sourceValues(input.displayName, input.aliases);
      const [duplicate] = await transaction
        .select({ id: sources.id })
        .from(sources)
        .where(
          and(
            eq(sources.householdId, householdId),
            eq(sources.key, values.key),
            ne(sources.id, sourceId),
          ),
        )
        .limit(1);
      if (duplicate) return 'conflict';

      const [source] = await transaction
        .update(sources)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(sources.householdId, householdId), eq(sources.id, sourceId)))
        .returning({
          id: sources.id,
          displayName: sources.displayName,
          key: sources.key,
          aliases: sources.aliases,
        });
      return source ?? 'not_found';
    });
  }

  async deleteSource(
    householdId: string,
    sourceId: string,
  ): Promise<'deleted' | 'not_found' | 'in_use'> {
    return this.db.transaction(async (transaction) => {
      const [source] = await transaction
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.householdId, householdId), eq(sources.id, sourceId)))
        .limit(1);
      if (!source) return 'not_found';

      const [income, expense] = await Promise.all([
        transaction
          .select({ id: incomes.id })
          .from(incomes)
          .where(and(eq(incomes.householdId, householdId), eq(incomes.sourceId, sourceId)))
          .limit(1),
        transaction
          .select({ id: expenses.id })
          .from(expenses)
          .where(and(eq(expenses.householdId, householdId), eq(expenses.sourceId, sourceId)))
          .limit(1),
      ]);
      if (income.length || expense.length) return 'in_use';

      await transaction
        .delete(sources)
        .where(and(eq(sources.householdId, householdId), eq(sources.id, sourceId)));
      return 'deleted';
    });
  }

  async copySources(
    sourceHouseholdId: string,
    targetHouseholdId: string,
    sourceIds: string[],
  ): Promise<CopyHouseholdSourcesResponse | null> {
    return this.db.transaction(async (transaction) => {
      const selectedSources = await transaction
        .select({
          displayName: sources.displayName,
          key: sources.key,
          aliases: sources.aliases,
        })
        .from(sources)
        .where(and(eq(sources.householdId, sourceHouseholdId), inArray(sources.id, sourceIds)));
      if (selectedSources.length !== sourceIds.length) return null;

      const copied = await transaction
        .insert(sources)
        .values(selectedSources.map((source) => ({ householdId: targetHouseholdId, ...source })))
        .onConflictDoNothing({ target: [sources.householdId, sources.key] })
        .returning({ id: sources.id });
      return {
        copiedCount: copied.length,
        skippedCount: selectedSources.length - copied.length,
      };
    });
  }
}


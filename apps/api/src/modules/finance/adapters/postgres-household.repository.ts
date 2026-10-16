import type { CreateHouseholdRequest, HouseholdMonthResponse, UpdateHouseholdRequest } from '@monthloom/contracts';
import { and, asc, eq, inArray } from 'drizzle-orm';

import type { Database } from '../../../infrastructure/database/client.js';
import { householdMembers, households, users } from '../../../infrastructure/database/schema/index.js';
import type { HouseholdRepository } from '../finance.repository.js';
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

export class PostgresHouseholdRepository implements HouseholdRepository {
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
        .values({ ...input, ownerId: userId })
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


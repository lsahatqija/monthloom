import { and, eq } from 'drizzle-orm';

import type { Database } from '../../../infrastructure/database/client.js';
import {
  householdInvitations,
  householdMembers,
  households,
  users,
} from '../../../infrastructure/database/schema/index.js';
import type { InvitationRepository } from '../finance.repository.js';
import type { AcceptInvitationResult, HouseholdInvitationRecord } from '../finance.types.js';

export class PostgresInvitationRepository implements InvitationRepository {
  constructor(private readonly db: Database) {}

  async createInvitation(
    householdId: string,
    createdById: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.db.insert(householdInvitations).values({
      householdId,
      createdById,
      tokenHash,
      expiresAt,
    });
  }

  async deleteInvitation(tokenHash: string): Promise<void> {
    await this.db.delete(householdInvitations).where(eq(householdInvitations.tokenHash, tokenHash));
  }

  async findInvitation(tokenHash: string): Promise<HouseholdInvitationRecord | null> {
    const [record] = await this.db
      .select({
        id: householdInvitations.id,
        householdId: householdInvitations.householdId,
        householdName: households.name,
        householdIcon: households.icon,
        householdColor: households.color,
        expiresAt: householdInvitations.expiresAt,
        acceptedAt: householdInvitations.acceptedAt,
      })
      .from(householdInvitations)
      .innerJoin(households, eq(householdInvitations.householdId, households.id))
      .where(eq(householdInvitations.tokenHash, tokenHash))
      .limit(1);
    return record ?? null;
  }

  async acceptInvitation(
    tokenHash: string,
    userId: string,
    now: Date,
  ): Promise<AcceptInvitationResult> {
    return this.db.transaction(async (transaction) => {
      // Lock both the invitation and the user so a token is single-use and a user's first
      // concurrently accepted household can be selected as primary deterministically.
      await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for('update');
      const [invitation] = await transaction
        .select()
        .from(householdInvitations)
        .where(eq(householdInvitations.tokenHash, tokenHash))
        .limit(1)
        .for('update');

      if (!invitation) return { status: 'not_found' };
      if (invitation.acceptedAt) return { status: 'used' };
      if (invitation.expiresAt.getTime() <= now.getTime()) return { status: 'expired' };

      const [existingMember] = await transaction
        .select({ householdId: householdMembers.householdId })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, invitation.householdId),
            eq(householdMembers.userId, userId),
          ),
        )
        .limit(1);
      if (existingMember) {
        return { status: 'already_member', householdId: invitation.householdId };
      }

      const [existingMembership] = await transaction
        .select({ householdId: householdMembers.householdId })
        .from(householdMembers)
        .where(eq(householdMembers.userId, userId))
        .limit(1);
      await transaction.insert(householdMembers).values({
        householdId: invitation.householdId,
        userId,
        isPrimary: !existingMembership,
      });
      await transaction
        .update(householdInvitations)
        .set({ acceptedAt: now, acceptedById: userId })
        .where(eq(householdInvitations.id, invitation.id));

      return { status: 'accepted', householdId: invitation.householdId };
    });
  }
}


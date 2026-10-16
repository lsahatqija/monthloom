import type { CreateHouseholdRequest, UpdateHouseholdRequest } from '@monthloom/contracts';

import { AuthorizationError, ConflictError, NotFoundError } from '../../shared/errors/index.js';

import type { HouseholdRepository } from './finance.repository.js';
import { requireHouseholdMember } from './household-access.js';
import { serializeHousehold } from './household-serialization.js';

export class HouseholdService {
  constructor(private readonly households: HouseholdRepository) {}

  async createHousehold(userId: string, input: CreateHouseholdRequest) {
    return serializeHousehold(await this.households.createHousehold(userId, input));
  }

  async listHouseholds(userId: string) {
    const households = await this.households.listHouseholds(userId);
    return households.map((household) => ({
      ...serializeHousehold(household),
      isPrimary: household.isPrimary,
      members: household.members.map((member) => ({
        ...member,
        joinedAt: member.joinedAt.toISOString(),
      })),
    }));
  }

  async updateHousehold(householdId: string, userId: string, input: UpdateHouseholdRequest) {
    await requireHouseholdMember(this.households, householdId, userId);
    return serializeHousehold(await this.households.updateHousehold(householdId, input));
  }

  async setPrimaryHousehold(householdId: string, userId: string): Promise<void> {
    await requireHouseholdMember(this.households, householdId, userId);
    await this.households.setPrimaryHousehold(householdId, userId);
  }

  async removeMember(
    householdId: string,
    memberId: string,
    requestingUserId: string,
  ): Promise<void> {
    const household = await this.households.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');
    if (household.ownerId !== requestingUserId) {
      throw new AuthorizationError('Only the household owner can remove members.');
    }
    if (memberId === household.ownerId) {
      throw new ConflictError('The owner must leave the household and transfer ownership.');
    }
    if (!(await this.households.removeMember(householdId, memberId))) {
      throw new NotFoundError('Household member was not found.');
    }
  }

  async leaveHousehold(householdId: string, userId: string, newOwnerId?: string): Promise<void> {
    await requireHouseholdMember(this.households, householdId, userId);
    const household = await this.households.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');

    if (household.ownerId === userId) {
      const members = await this.households.getMembers(householdId);
      if (members.length === 1) {
        throw new ConflictError('You cannot leave a household with no other members.');
      }
      if (!newOwnerId) {
        throw new ConflictError('Select a new owner before leaving the household.');
      }
      if (
        newOwnerId === userId ||
        !(await this.households.isMember(householdId, newOwnerId))
      ) {
        throw new ConflictError('The new owner must be another household member.');
      }
    } else if (newOwnerId) {
      throw new ConflictError('Only the current owner can transfer ownership.');
    }

    if (!(await this.households.leaveHousehold(householdId, userId, newOwnerId))) {
      throw new NotFoundError('Household member was not found.');
    }
  }

  async deleteHousehold(householdId: string, userId: string): Promise<void> {
    const household = await this.households.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');
    if (household.ownerId !== userId) {
      throw new AuthorizationError('Only the household owner can delete it.');
    }
    if (!(await this.households.deleteHousehold(householdId))) {
      throw new NotFoundError('Household was not found.');
    }
  }
}


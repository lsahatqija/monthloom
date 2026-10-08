import {
  Constants,
  type CopyHouseholdSourcesRequest,
  type CreateHouseholdInvitationRequest,
  type CreateHouseholdSourceRequest,
  type CreateHouseholdTransactionRequest,
  type CreateHouseholdRequest,
  type HouseholdMonthResponse,
  type PublicUser,
  type TransactionEditScope,
  type UpdateHouseholdRequest,
  type UpdateHouseholdSourceRequest,
  type UpdateHouseholdTransactionRequest,
} from '@template/contracts';

import { config } from '../../config/index.js';
import { generateSessionToken, hashSessionToken } from '../../infrastructure/security/tokens.js';
import { AuthorizationError, ConflictError, NotFoundError } from '../../shared/errors/index.js';
import type { AutomatedEmailService } from '../email/automated-email.service.js';

import type { FinanceRepository } from './finance.repository.js';
import type { HouseholdRecord } from './finance.types.js';

function serializeHousehold(household: HouseholdRecord | null) {
  if (!household) throw new NotFoundError('No household was found.');
  return {
    ...household,
    createdAt: household.createdAt.toISOString(),
    updatedAt: household.updatedAt.toISOString(),
  };
}

function toCents(amount: string): number {
  const [whole, fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

function fromCents(amount: number): string {
  return (amount / 100).toFixed(2);
}

export class FinanceService {
  constructor(
    private readonly financeRepository: FinanceRepository,
    private readonly emailService: AutomatedEmailService,
  ) {}

  async createHousehold(userId: string, input: CreateHouseholdRequest) {
    return serializeHousehold(await this.financeRepository.createHousehold(userId, input));
  }

  async listHouseholds(userId: string) {
    const households = await this.financeRepository.listHouseholds(userId);
    return households.map((household) => ({
      ...serializeHousehold(household),
      isPrimary: household.isPrimary,
      members: household.members.map((member) => ({
        ...member,
        joinedAt: member.joinedAt.toISOString(),
      })),
    }));
  }

  async getPrimaryMonth(userId: string, month: string): Promise<HouseholdMonthResponse> {
    const household = await this.financeRepository.findPrimaryHousehold(userId);
    if (!household) throw new NotFoundError('You do not have an active household yet.');
    return this.getHouseholdMonth(household.id, userId, month);
  }

  async getHouseholdMonth(
    householdId: string,
    userId: string,
    month: string,
  ): Promise<HouseholdMonthResponse> {
    if (!(await this.financeRepository.isMember(householdId, userId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    const household = await this.financeRepository.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');

    const [transactions, members, sources] = await Promise.all([
      this.financeRepository.getMonth(householdId, month),
      this.financeRepository.getMembers(householdId),
      this.financeRepository.getSources(householdId),
    ]);
    const currentMember = members.find((member) => member.id === userId);
    const orderedMembers = currentMember
      ? [currentMember, ...members.filter((member) => member.id !== userId)]
      : members;
    const income = transactions
      .filter((entry) => entry.kind === 'income')
      .reduce((sum, entry) => sum + toCents(entry.amount), 0);
    const expenses = transactions
      .filter((entry) => entry.kind === 'expense')
      .reduce((sum, entry) => sum + toCents(entry.amount), 0);

    return {
      household: serializeHousehold(household),
      month,
      summary: {
        income: fromCents(income),
        expenses: fromCents(expenses),
        leftover: fromCents(income - expenses),
      },
      members: orderedMembers,
      sources,
      transactions,
    };
  }

  async createTransaction(
    householdId: string,
    requestingUserId: string,
    input: CreateHouseholdTransactionRequest,
  ) {
    if (!(await this.financeRepository.isMember(householdId, requestingUserId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    if (!(await this.financeRepository.isMember(householdId, input.userId))) {
      throw new AuthorizationError('The selected user is not a member of this household.');
    }
    if (!(await this.financeRepository.getSource(householdId, input.sourceId))) {
      throw new NotFoundError('The selected source was not found in this household.');
    }
    return this.financeRepository.createTransaction(householdId, input);
  }

  async createSource(
    householdId: string,
    requestingUserId: string,
    input: CreateHouseholdSourceRequest,
  ) {
    if (!(await this.financeRepository.isMember(householdId, requestingUserId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    const source = await this.financeRepository.createSource(householdId, input);
    if (!source) throw new ConflictError('A source with this display name already exists.');
    return source;
  }

  async listSources(householdId: string, requestingUserId: string) {
    if (!(await this.financeRepository.isMember(householdId, requestingUserId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    return this.financeRepository.getSources(householdId);
  }

  async updateSource(
    householdId: string,
    sourceId: string,
    requestingUserId: string,
    input: UpdateHouseholdSourceRequest,
  ) {
    if (!(await this.financeRepository.isMember(householdId, requestingUserId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    const source = await this.financeRepository.updateSource(householdId, sourceId, input);
    if (source === 'not_found') throw new NotFoundError('Source was not found.');
    if (source === 'conflict') {
      throw new ConflictError('A source with this display name already exists.');
    }
    return source;
  }

  async deleteSource(
    householdId: string,
    sourceId: string,
    requestingUserId: string,
  ): Promise<void> {
    if (!(await this.financeRepository.isMember(householdId, requestingUserId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    const result = await this.financeRepository.deleteSource(householdId, sourceId);
    if (result === 'not_found') throw new NotFoundError('Source was not found.');
    if (result === 'in_use') {
      throw new ConflictError('Sources used by transactions cannot be deleted.');
    }
  }

  async copySources(
    sourceHouseholdId: string,
    requestingUserId: string,
    input: CopyHouseholdSourcesRequest,
  ) {
    if (sourceHouseholdId === input.targetHouseholdId) {
      throw new ConflictError('Choose two different households.');
    }
    const [canReadSource, canWriteTarget] = await Promise.all([
      this.financeRepository.isMember(sourceHouseholdId, requestingUserId),
      this.financeRepository.isMember(input.targetHouseholdId, requestingUserId),
    ]);
    if (!canReadSource || !canWriteTarget) {
      throw new AuthorizationError('You must be a member of both households.');
    }
    const result = await this.financeRepository.copySources(
      sourceHouseholdId,
      input.targetHouseholdId,
      input.sourceIds,
    );
    if (!result) throw new NotFoundError('One or more selected sources were not found.');
    return result;
  }

  async updateTransaction(
    householdId: string,
    transactionId: string,
    requestingUserId: string,
    input: UpdateHouseholdTransactionRequest,
  ) {
    if (!(await this.financeRepository.isMember(householdId, requestingUserId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    if (!(await this.financeRepository.isMember(householdId, input.transaction.userId))) {
      throw new AuthorizationError('The selected user is not a member of this household.');
    }
    if (!(await this.financeRepository.getSource(householdId, input.transaction.sourceId))) {
      throw new NotFoundError('The selected source was not found in this household.');
    }
    const transaction = await this.financeRepository.updateTransaction(
      householdId,
      transactionId,
      input,
    );
    if (!transaction) throw new NotFoundError('Transaction was not found.');
    return transaction;
  }

  async removeTransaction(
    householdId: string,
    transactionId: string,
    requestingUserId: string,
    scope: TransactionEditScope,
  ): Promise<void> {
    if (!(await this.financeRepository.isMember(householdId, requestingUserId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    if (!(await this.financeRepository.removeTransaction(householdId, transactionId, scope))) {
      throw new NotFoundError('Transaction was not found.');
    }
  }

  async updateHousehold(householdId: string, userId: string, input: UpdateHouseholdRequest) {
    if (!(await this.financeRepository.isMember(householdId, userId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    return serializeHousehold(await this.financeRepository.updateHousehold(householdId, input));
  }

  async setPrimaryHousehold(householdId: string, userId: string): Promise<void> {
    if (!(await this.financeRepository.isMember(householdId, userId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    await this.financeRepository.setPrimaryHousehold(householdId, userId);
  }

  async removeMember(
    householdId: string,
    memberId: string,
    requestingUserId: string,
  ): Promise<void> {
    const household = await this.financeRepository.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');
    if (household.ownerId !== requestingUserId) {
      throw new AuthorizationError('Only the household owner can remove members.');
    }
    if (memberId === household.ownerId) {
      throw new ConflictError('The owner must leave the household and transfer ownership.');
    }
    if (!(await this.financeRepository.removeMember(householdId, memberId))) {
      throw new NotFoundError('Household member was not found.');
    }
  }

  async leaveHousehold(householdId: string, userId: string, newOwnerId?: string): Promise<void> {
    if (!(await this.financeRepository.isMember(householdId, userId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    const household = await this.financeRepository.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');

    if (household.ownerId === userId) {
      const members = await this.financeRepository.getMembers(householdId);
      if (members.length === 1) {
        throw new ConflictError('You cannot leave a household with no other members.');
      }
      if (!newOwnerId) {
        throw new ConflictError('Select a new owner before leaving the household.');
      }
      if (
        newOwnerId === userId ||
        !(await this.financeRepository.isMember(householdId, newOwnerId))
      ) {
        throw new ConflictError('The new owner must be another household member.');
      }
    } else if (newOwnerId) {
      throw new ConflictError('Only the current owner can transfer ownership.');
    }

    if (!(await this.financeRepository.leaveHousehold(householdId, userId, newOwnerId))) {
      throw new NotFoundError('Household member was not found.');
    }
  }

  async deleteHousehold(householdId: string, userId: string): Promise<void> {
    const household = await this.financeRepository.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');
    if (household.ownerId !== userId) {
      throw new AuthorizationError('Only the household owner can delete it.');
    }
    if (!(await this.financeRepository.deleteHousehold(householdId))) {
      throw new NotFoundError('Household was not found.');
    }
  }

  async createInvitation(
    householdId: string,
    invitingUser: PublicUser,
    input: CreateHouseholdInvitationRequest,
  ) {
    if (!(await this.financeRepository.isMember(householdId, invitingUser.id))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    const household = await this.financeRepository.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + Constants.HOUSEHOLD_INVITATION_TTL_MS);
    await this.financeRepository.createInvitation(
      householdId,
      invitingUser.id,
      tokenHash,
      expiresAt,
    );
    const invitationUrl = new URL(`/invite/${token}`, config.web.publicUrl).toString();
    const sentTo = input.email.trim().toLowerCase();

    try {
      await this.emailService.sendHouseholdInvitation({
        to: sentTo,
        inviterName: invitingUser.displayName,
        householdName: household.name,
        invitationUrl,
        expiresAt,
      });
    } catch (error) {
      await this.financeRepository.deleteInvitation(tokenHash).catch(() => undefined);
      throw error;
    }

    return {
      sentTo,
      household: {
        id: household.id,
        name: household.name,
        icon: household.icon,
        color: household.color,
      },
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getInvitation(token: string) {
    const invitation = await this.financeRepository.findInvitation(hashSessionToken(token));
    if (!invitation || invitation.acceptedAt) {
      throw new NotFoundError('This household invitation is invalid or has already been used.');
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundError('This household invitation has expired.');
    }
    return {
      household: {
        id: invitation.householdId,
        name: invitation.householdName,
        icon: invitation.householdIcon,
        color: invitation.householdColor,
      },
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async acceptInvitation(token: string, userId: string) {
    const result = await this.financeRepository.acceptInvitation(
      hashSessionToken(token),
      userId,
      new Date(),
    );
    if (result.status === 'not_found' || result.status === 'used') {
      throw new NotFoundError('This household invitation is invalid or has already been used.');
    }
    if (result.status === 'expired') {
      throw new NotFoundError('This household invitation has expired.');
    }
    if (result.status === 'already_member') {
      throw new ConflictError('You are already a member of this household.');
    }
    return { householdId: result.householdId };
  }
}

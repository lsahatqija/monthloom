import {
  Constants,
  type CreateHouseholdInvitationRequest,
  type PublicUser,
} from '@monthloom/contracts';

import { config } from '../../config/index.js';
import type { Logger } from '../../infrastructure/logging/logger.js';
import { generateSessionToken, hashSessionToken } from '../../infrastructure/security/tokens.js';
import { AuthorizationError, ConflictError, NotFoundError } from '../../shared/errors/index.js';

import type { HouseholdRepository, InvitationRepository } from './finance.repository.js';

export interface InvitationEmailNotifier {
  sendHouseholdInvitation(input: {
    to: string;
    inviterName: string;
    householdName: string;
    invitationUrl: string;
    expiresAt: Date;
  }): Promise<void>;
}

export class InvitationService {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly invitations: InvitationRepository,
    private readonly emailNotifier: InvitationEmailNotifier,
    private readonly logger: Logger,
  ) {}

  async createInvitation(
    householdId: string,
    invitingUser: PublicUser,
    input: CreateHouseholdInvitationRequest,
  ) {
    if (!(await this.households.isMember(householdId, invitingUser.id))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    if (input.mode === 'email' && !invitingUser.emailVerified) {
      throw new AuthorizationError('Verify your email address before sending invitations.');
    }
    const household = await this.households.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');

    const expiresAt = new Date(Date.now() + Constants.HOUSEHOLD_INVITATION_TTL_MS);
    const householdSummary = {
      id: household.id,
      name: household.name,
      icon: household.icon,
      color: household.color,
    };

    if (input.mode === 'link') {
      const token = generateSessionToken();
      await this.invitations.createInvitation(
        householdId,
        invitingUser.id,
        hashSessionToken(token),
        expiresAt,
      );
      return {
        mode: 'link' as const,
        token,
        household: householdSummary,
        expiresAt: expiresAt.toISOString(),
      };
    }

    const deliveryResults = await Promise.all(
      input.emails.map(async (email) => {
        const recipient = email.toLowerCase();
        const token = generateSessionToken();
        const tokenHash = hashSessionToken(token);

        try {
          await this.invitations.createInvitation(
            householdId,
            invitingUser.id,
            tokenHash,
            expiresAt,
          );
          await this.emailNotifier.sendHouseholdInvitation({
            to: recipient,
            inviterName: invitingUser.displayName,
            householdName: household.name,
            invitationUrl: new URL(`/invite/${token}`, config.web.publicUrl).toString(),
            expiresAt,
          });
          return { recipient, sent: true } as const;
        } catch (error) {
          await this.invitations.deleteInvitation(tokenHash).catch(() => undefined);
          this.logger.error(
            { err: error, householdId },
            'Failed to send a household invitation email',
          );
          return { recipient, sent: false } as const;
        }
      }),
    );

    return {
      mode: 'email' as const,
      sentTo: deliveryResults.filter((result) => result.sent).map((result) => result.recipient),
      failedTo: deliveryResults.filter((result) => !result.sent).map((result) => result.recipient),
      household: householdSummary,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getInvitation(token: string) {
    const invitation = await this.invitations.findInvitation(hashSessionToken(token));
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
    const result = await this.invitations.acceptInvitation(
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


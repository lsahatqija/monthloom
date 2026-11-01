import type { HouseholdTransaction } from '@monthloom/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { Logger } from '../../src/infrastructure/logging/logger.js';
import type { AutomatedEmailService } from '../../src/modules/email/automated-email.service.js';
import type {
  HouseholdRepository,
  InvitationRepository,
  SourceRepository,
  TransactionRepository,
} from '../../src/modules/finance/finance.repository.js';
import { HouseholdService } from '../../src/modules/finance/household.service.js';
import { InvitationService } from '../../src/modules/finance/invitation.service.js';
import { MonthViewService } from '../../src/modules/finance/month-view.service.js';
import { RangeViewService } from '../../src/modules/finance/range-view.service.js';
import { SourceService } from '../../src/modules/finance/source.service.js';
import { TransactionService } from '../../src/modules/finance/transaction.service.js';
import { user } from '../fixtures.js';

describe('finance service', () => {
  const households = mock<HouseholdRepository>();
  const invitations = mock<InvitationRepository>();
  const sources = mock<SourceRepository>();
  const transactions = mock<TransactionRepository>();
  const householdService = new HouseholdService(households);
  const invitationService = new InvitationService(
    households,
    invitations,
    mock<AutomatedEmailService>(),
    mock<Logger>(),
  );
  const monthViewService = new MonthViewService(households, sources, transactions);
  const rangeViewService = new RangeViewService(households, sources, transactions);
  const sourceService = new SourceService(households, sources);
  const transactionService = new TransactionService(households, sources, transactions);
  const household = {
    id: 'household',
    name: 'Home',
    currency: 'EUR',
    icon: 'small-house' as const,
    color: '#123456',
    ownerId: user.id,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  beforeEach(() => vi.resetAllMocks());

  it('rejects non-members before reading private financial data', async () => {
    households.isMember.mockResolvedValue(false);
    await expect(
      monthViewService.getHouseholdMonth(household.id, user.id, '2026-01'),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(transactions.getMonth).not.toHaveBeenCalled();
  });

  it('enforces range bounds and membership before reading transactions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    try {
      await expect(
        rangeViewService.getHouseholdRange(household.id, user.id, '2021-05', '2026-06'),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(transactions.getRange).not.toHaveBeenCalled();

      households.isMember.mockResolvedValue(false);
      await expect(
        rangeViewService.getHouseholdRange(household.id, user.id, '2021-06', '2027-06'),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(transactions.getRange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('calculates decimal totals exactly and puts the current user first', async () => {
    households.isMember.mockResolvedValue(true);
    households.findHousehold.mockResolvedValue(household);
    households.getMembers.mockResolvedValue([{ ...user, id: 'other' }, user]);
    sources.getSources.mockResolvedValue([]);
    transactions.getMonth.mockResolvedValue([
      mock<HouseholdTransaction>({ kind: 'income', amount: '0.10' }),
      mock<HouseholdTransaction>({ kind: 'income', amount: '0.20' }),
      mock<HouseholdTransaction>({ kind: 'expense', amount: '0.40' }),
    ]);
    const result = await monthViewService.getHouseholdMonth(household.id, user.id, '2026-01');
    expect(result.summary).toEqual({ income: '0.30', expenses: '0.40', leftover: '-0.10' });
    expect(result.members[0]!.id).toBe(user.id);
  });

  it('does not allow deletion of sources in use', async () => {
    households.isMember.mockResolvedValue(true);
    sources.deleteSource.mockResolvedValue('in_use');
    await expect(sourceService.deleteSource(household.id, 'source', user.id)).rejects.toMatchObject(
      {
        statusCode: 409,
      },
    );
  });

  it('rejects transaction writes from non-members', async () => {
    households.isMember.mockResolvedValue(false);
    await expect(
      transactionService.removeTransaction(household.id, 'transaction', user.id, 'current'),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(transactions.removeTransaction).not.toHaveBeenCalled();
  });

  it('requires membership in both households before copying sources', async () => {
    households.isMember.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(
      sourceService.copySources('from', user.id, {
        targetHouseholdId: 'to',
        sourceIds: ['source'],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(sources.copySources).not.toHaveBeenCalled();
  });

  it('requires a verified email address before sending email invitations', async () => {
    households.isMember.mockResolvedValue(true);
    await expect(
      invitationService.createInvitation(
        household.id,
        {
          ...user,
          emailVerified: false,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
        { mode: 'email', emails: ['invitee@example.com'] },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(invitations.createInvitation).not.toHaveBeenCalled();
  });

  it('uses the inviting user locale for recipients without an account', async () => {
    const notifier = mock<AutomatedEmailService>();
    const service = new InvitationService(households, invitations, notifier, mock<Logger>());
    households.isMember.mockResolvedValue(true);
    households.findHousehold.mockResolvedValue(household);

    await service.createInvitation(
      household.id,
      {
        ...user,
        locale: 'tr',
        emailVerified: true,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      { mode: 'email', emails: ['invitee@example.com'] },
    );

    expect(notifier.sendHouseholdInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'invitee@example.com', locale: 'tr' }),
    );
  });

  it('prevents an owner from leaving the last household member behind as nobody', async () => {
    households.isMember.mockResolvedValue(true);
    households.findHousehold.mockResolvedValue(household);
    households.getMembers.mockResolvedValue([user]);
    await expect(householdService.leaveHousehold(household.id, user.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(households.leaveHousehold).not.toHaveBeenCalled();
  });

  it('restricts household deletion to the owner', async () => {
    households.findHousehold.mockResolvedValue(household);
    await expect(householdService.deleteHousehold(household.id, 'other')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(households.deleteHousehold).not.toHaveBeenCalled();
  });
});

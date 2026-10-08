import type { HouseholdTransaction } from '@template/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { Logger } from '../../src/infrastructure/logging/logger.js';
import type { AutomatedEmailService } from '../../src/modules/email/automated-email.service.js';
import type { FinanceRepository } from '../../src/modules/finance/finance.repository.js';
import { FinanceService } from '../../src/modules/finance/finance.service.js';
import { user } from '../fixtures.js';

describe('finance service', () => {
  const repository = mock<FinanceRepository>();
  const service = new FinanceService(repository, mock<AutomatedEmailService>(), mock<Logger>());
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
    repository.isMember.mockResolvedValue(false);
    await expect(service.getHouseholdMonth(household.id, user.id, '2026-01')).rejects.toMatchObject(
      { statusCode: 403 },
    );
    expect(repository.getMonth).not.toHaveBeenCalled();
  });

  it('calculates decimal totals exactly and puts the current user first', async () => {
    repository.isMember.mockResolvedValue(true);
    repository.findHousehold.mockResolvedValue(household);
    repository.getMembers.mockResolvedValue([{ ...user, id: 'other' }, user]);
    repository.getSources.mockResolvedValue([]);
    repository.getMonth.mockResolvedValue([
      mock<HouseholdTransaction>({ kind: 'income', amount: '0.10' }),
      mock<HouseholdTransaction>({ kind: 'income', amount: '0.20' }),
      mock<HouseholdTransaction>({ kind: 'expense', amount: '0.40' }),
    ]);
    const result = await service.getHouseholdMonth(household.id, user.id, '2026-01');
    expect(result.summary).toEqual({ income: '0.30', expenses: '0.40', leftover: '-0.10' });
    expect(result.members[0]!.id).toBe(user.id);
  });

  it('does not allow deletion of sources in use', async () => {
    repository.isMember.mockResolvedValue(true);
    repository.deleteSource.mockResolvedValue('in_use');
    await expect(service.deleteSource(household.id, 'source', user.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('requires membership in both households before copying sources', async () => {
    repository.isMember.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(
      service.copySources('from', user.id, { targetHouseholdId: 'to', sourceIds: ['source'] }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.copySources).not.toHaveBeenCalled();
  });

  it('prevents an owner from leaving the last household member behind as nobody', async () => {
    repository.isMember.mockResolvedValue(true);
    repository.findHousehold.mockResolvedValue(household);
    repository.getMembers.mockResolvedValue([user]);
    await expect(service.leaveHousehold(household.id, user.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repository.leaveHousehold).not.toHaveBeenCalled();
  });

  it('restricts household deletion to the owner', async () => {
    repository.findHousehold.mockResolvedValue(household);
    await expect(service.deleteHousehold(household.id, 'other')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(repository.deleteHousehold).not.toHaveBeenCalled();
  });
});

import express, { type RequestHandler } from 'express';
import type { DestinationStream } from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { auditEvent } from '../../src/infrastructure/logging/audit-logger.js';
import { createCategoryLogger } from '../../src/infrastructure/logging/logger.js';
import { errorHandler } from '../../src/middleware/error-handler.middleware.js';
import { FinanceController } from '../../src/modules/finance/finance.controller.js';
import { createFinanceRouter } from '../../src/modules/finance/finance.routes.js';
import type { HouseholdService } from '../../src/modules/finance/household.service.js';
import type { InvitationService } from '../../src/modules/finance/invitation.service.js';
import type { MonthViewService } from '../../src/modules/finance/month-view.service.js';
import type { RangeViewService } from '../../src/modules/finance/range-view.service.js';
import type { SourceService } from '../../src/modules/finance/source.service.js';
import type { TransactionService } from '../../src/modules/finance/transaction.service.js';
import { toPublicUser } from '../../src/modules/users/user.service.js';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from '../../src/shared/errors/index.js';
import { user } from '../fixtures.js';

const ACTOR_ID = user.id;
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const HOUSEHOLD_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_ID = '44444444-4444-4444-8444-444444444444';
const TRANSACTION_ID = '55555555-5555-4555-8555-555555555555';
const TARGET_HOUSEHOLD_ID = '66666666-6666-4666-8666-666666666666';
const TOKEN = 'a'.repeat(43);
const publicUser = toPublicUser(user);
const source = {
  id: SOURCE_ID,
  displayName: 'Private source name',
  key: 'private-source-name',
  aliases: ['Private source alias'],
};
const transaction = {
  id: TRANSACTION_ID,
  kind: 'expense' as const,
  type: 'groceries' as const,
  date: '2024-04-19',
  icon: 'shopping-cart' as const,
  color: '#123456',
  amount: '123.45',
  recurring: false,
  recurrenceInterval: 1,
  recurrenceUnit: 'month' as const,
  expiresOn: null,
  projected: false,
  user: publicUser,
  source,
};
const transactionInput = {
  kind: transaction.kind,
  type: transaction.type,
  date: transaction.date,
  sourceId: SOURCE_ID,
  icon: transaction.icon,
  color: transaction.color,
  amount: transaction.amount,
  userId: ACTOR_ID,
  recurring: false,
  expiresOn: null,
};

describe('household audit routes', () => {
  const households = mock<HouseholdService>();
  const invitations = mock<InvitationService>();
  const monthView = mock<MonthViewService>();
  const rangeView = mock<RangeViewService>();
  const sources = mock<SourceService>();
  const transactions = mock<TransactionService>();

  beforeEach(() => {
    vi.resetAllMocks();
    invitations.createInvitation.mockResolvedValue({
      mode: 'email',
      sentTo: ['invitee@example.com'],
      failedTo: ['failed@example.com'],
      household: {
        id: HOUSEHOLD_ID,
        name: 'Private household name',
        icon: 'small-house',
        color: '#123456',
      },
      expiresAt: new Date().toISOString(),
    });
    invitations.acceptInvitation.mockResolvedValue({ householdId: HOUSEHOLD_ID });
    households.removeMember.mockResolvedValue();
    households.leaveHousehold.mockResolvedValue();
    sources.createSource.mockResolvedValue(source);
    sources.updateSource.mockResolvedValue(source);
    sources.deleteSource.mockResolvedValue();
    sources.copySources.mockResolvedValue({ copiedCount: 1, skippedCount: 0 });
    transactions.createTransaction.mockResolvedValue(transaction);
    transactions.updateTransaction.mockResolvedValue(transaction);
    transactions.removeTransaction.mockResolvedValue('expense');
  });

  function createApp() {
    const lines: string[] = [];
    const destination: DestinationStream = { write: (message) => lines.push(message) };
    const logger = createCategoryLogger('audit', destination);
    logger.level = 'info';
    const audited: typeof auditEvent = (event, options = {}) =>
      auditEvent(event, { ...options, logger });
    const requireAuth: RequestHandler = (req, _res, next) => {
      if (req.get('x-deny-authentication')) {
        next(new AuthenticationError('Authentication required.', 'AUTHENTICATION_REQUIRED'));
        return;
      }
      req.authUser = publicUser;
      next();
    };
    const controller = new FinanceController({
      households,
      invitations,
      monthView,
      rangeView,
      sources,
      transactions,
    });
    const app = express();
    app.use((req, _res, next) => {
      req.id = 'request-1';
      next();
    });
    app.use(express.json());
    app.use('/households', createFinanceRouter(controller, requireAuth, audited));
    app.use(errorHandler);
    return {
      app,
      records: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
    };
  }

  it('records invitation and membership lifecycle events with minimal fields', async () => {
    const { app, records } = createApp();
    await request(app)
      .post(`/households/${HOUSEHOLD_ID}/invitations`)
      .send({ mode: 'email', emails: ['invitee@example.com', 'failed@example.com'] })
      .expect(201);
    await request(app).post(`/households/invitations/${TOKEN}/accept`).expect(200);
    await request(app).delete(`/households/${HOUSEHOLD_ID}/members/${MEMBER_ID}`).expect(204);
    await request(app)
      .post(`/households/${HOUSEHOLD_ID}/leave`)
      .send({ newOwnerId: MEMBER_ID })
      .expect(204);

    expect(records()).toEqual([
      expect.objectContaining({
        event: 'household.invitation_sent',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        householdId: HOUSEHOLD_ID,
        sentCount: 1,
        failedCount: 1,
      }),
      expect.objectContaining({
        event: 'household.invitation_accepted',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        householdId: HOUSEHOLD_ID,
      }),
      expect.objectContaining({
        event: 'household.member_removed',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        targetUserId: MEMBER_ID,
        householdId: HOUSEHOLD_ID,
      }),
      expect.objectContaining({
        event: 'household.ownership_transferred',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        targetUserId: MEMBER_ID,
        householdId: HOUSEHOLD_ID,
      }),
      expect.objectContaining({
        event: 'household.left',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        householdId: HOUSEHOLD_ID,
      }),
    ]);
    expect(records().every((record) => !('ip' in record) && !('userAgent' in record))).toBe(true);

    const serialized = JSON.stringify(records());
    expect(serialized).not.toContain('invitee@example.com');
    expect(serialized).not.toContain('failed@example.com');
    expect(serialized).not.toContain('Private household name');
    expect(serialized).not.toContain(TOKEN);
  });

  it('records authentication, authorization, and expired-invitation failures safely', async () => {
    invitations.createInvitation.mockRejectedValue(
      new AuthorizationError('You are not a member of this household.'),
    );
    invitations.acceptInvitation.mockRejectedValue(
      new NotFoundError('This household invitation has expired.', 'INVITATION_EXPIRED'),
    );
    const { app, records } = createApp();

    await request(app)
      .post(`/households/${HOUSEHOLD_ID}/invitations`)
      .send({ mode: 'email', emails: ['private@example.com'] })
      .expect(403);
    await request(app).post(`/households/invitations/${TOKEN}/accept`).expect(404);
    await request(app)
      .delete(`/households/${HOUSEHOLD_ID}/members/${MEMBER_ID}`)
      .set('x-deny-authentication', 'true')
      .expect(401);

    expect(records()).toEqual([
      expect.objectContaining({
        event: 'household.invitation_sent',
        level: 'warn',
        outcome: 'denied',
        reason: 'NOT_AUTHORIZED',
      }),
      expect.objectContaining({
        event: 'household.invitation_accepted',
        level: 'warn',
        outcome: 'failure',
        reason: 'INVITATION_EXPIRED',
      }),
      expect.objectContaining({
        event: 'household.member_removed',
        level: 'warn',
        outcome: 'denied',
        reason: 'AUTHENTICATION_REQUIRED',
      }),
    ]);
    expect(JSON.stringify(records())).not.toContain('private@example.com');
    expect(JSON.stringify(records())).not.toContain(TOKEN);
  });

  it('records source and transaction mutations with approved fields only', async () => {
    const { app, records } = createApp();

    await request(app)
      .post(`/households/${HOUSEHOLD_ID}/sources`)
      .send({ displayName: source.displayName, aliases: source.aliases })
      .expect(201);
    await request(app)
      .patch(`/households/${HOUSEHOLD_ID}/sources/${SOURCE_ID}`)
      .send({ displayName: source.displayName, aliases: source.aliases })
      .expect(200);
    await request(app).delete(`/households/${HOUSEHOLD_ID}/sources/${SOURCE_ID}`).expect(204);
    await request(app)
      .post(`/households/${HOUSEHOLD_ID}/sources/copy`)
      .send({ targetHouseholdId: TARGET_HOUSEHOLD_ID, sourceIds: [SOURCE_ID] })
      .expect(201);
    await request(app)
      .post(`/households/${HOUSEHOLD_ID}/transactions`)
      .send(transactionInput)
      .expect(201);
    await request(app)
      .patch(`/households/${HOUSEHOLD_ID}/transactions/${TRANSACTION_ID}`)
      .send({
        transaction: transactionInput,
        selection: { past: false, current: true, future: true },
      })
      .expect(200);
    await request(app)
      .delete(
        `/households/${HOUSEHOLD_ID}/transactions/${TRANSACTION_ID}?scope=current_and_future&occurrenceDate=2024-04-19`,
      )
      .expect(204);

    expect(records()).toEqual([
      expect.objectContaining({
        event: 'source.created',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        householdId: HOUSEHOLD_ID,
        sourceId: SOURCE_ID,
      }),
      expect.objectContaining({
        event: 'source.updated',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        householdId: HOUSEHOLD_ID,
        sourceId: SOURCE_ID,
      }),
      expect.objectContaining({
        event: 'source.deleted',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        householdId: HOUSEHOLD_ID,
        sourceId: SOURCE_ID,
      }),
      expect.objectContaining({
        event: 'source.copied',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        sourceHouseholdId: HOUSEHOLD_ID,
        targetHouseholdId: TARGET_HOUSEHOLD_ID,
        copiedCount: 1,
      }),
      expect.objectContaining({
        event: 'transaction.created',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        householdId: HOUSEHOLD_ID,
        transactionId: TRANSACTION_ID,
        transactionKind: 'expense',
      }),
      expect.objectContaining({
        event: 'transaction.updated',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        householdId: HOUSEHOLD_ID,
        transactionId: TRANSACTION_ID,
        transactionKind: 'expense',
        recurrenceScope: 'current_and_future',
      }),
      expect.objectContaining({
        event: 'transaction.deleted',
        outcome: 'success',
        actorUserId: ACTOR_ID,
        householdId: HOUSEHOLD_ID,
        transactionId: TRANSACTION_ID,
        transactionKind: 'expense',
        recurrenceScope: 'current_and_future',
      }),
    ]);
    expect(records().every((record) => !('ip' in record) && !('userAgent' in record))).toBe(true);

    const serialized = JSON.stringify(records());
    for (const forbidden of [
      source.displayName,
      source.aliases[0]!,
      transaction.amount,
      transaction.date,
      transaction.type,
      transaction.icon,
      transaction.color,
      'selection',
      'recurring',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('records finance failures and authentication denials without request data', async () => {
    sources.createSource.mockRejectedValue(
      new ConflictError('A source with this display name already exists.', 'SOURCE_NAME_CONFLICT'),
    );
    transactions.updateTransaction.mockRejectedValue(
      new NotFoundError('Transaction was not found.', 'TRANSACTION_NOT_FOUND'),
    );
    const { app, records } = createApp();

    await request(app)
      .post(`/households/${HOUSEHOLD_ID}/sources`)
      .send({ displayName: source.displayName, aliases: source.aliases })
      .expect(409);
    await request(app)
      .patch(`/households/${HOUSEHOLD_ID}/transactions/${TRANSACTION_ID}`)
      .send({
        transaction: transactionInput,
        selection: { past: false, current: true, future: false },
      })
      .expect(404);
    await request(app)
      .delete(`/households/${HOUSEHOLD_ID}/sources/${SOURCE_ID}`)
      .set('x-deny-authentication', 'true')
      .expect(401);

    expect(records()).toEqual([
      expect.objectContaining({
        event: 'source.created',
        level: 'warn',
        outcome: 'failure',
        reason: 'SOURCE_NAME_CONFLICT',
      }),
      expect.objectContaining({
        event: 'transaction.updated',
        level: 'warn',
        outcome: 'failure',
        reason: 'TRANSACTION_NOT_FOUND',
      }),
      expect.objectContaining({
        event: 'source.deleted',
        level: 'warn',
        outcome: 'denied',
        reason: 'AUTHENTICATION_REQUIRED',
      }),
    ]);
    const serialized = JSON.stringify(records());
    expect(serialized).not.toContain(source.displayName);
    expect(serialized).not.toContain(source.aliases[0]!);
    expect(serialized).not.toContain(transaction.amount);
    expect(serialized).not.toContain(transaction.date);
  });
});

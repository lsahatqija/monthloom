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
  NotFoundError,
} from '../../src/shared/errors/index.js';
import { user } from '../fixtures.js';

const ACTOR_ID = user.id;
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const HOUSEHOLD_ID = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'a'.repeat(43);
const publicUser = toPublicUser(user);

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
});

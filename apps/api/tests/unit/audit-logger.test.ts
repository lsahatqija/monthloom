import express, { type Express, type Request } from 'express';
import type { DestinationStream } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  auditEvent,
  createAuditRateLimitHandler,
  setAuditFields,
  type AuditFields,
} from '../../src/infrastructure/logging/audit-logger.js';
import { createCategoryLogger } from '../../src/infrastructure/logging/logger.js';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';
const HOUSEHOLD_ID = '33333333-3333-4333-8333-333333333333';

function auditApp(): {
  app: Express;
  logger: ReturnType<typeof createCategoryLogger>;
  records: () => Array<Record<string, unknown>>;
} {
  const lines: string[] = [];
  const destination: DestinationStream = { write: (message) => lines.push(message) };
  const logger = createCategoryLogger('audit', destination);
  logger.level = 'info';

  const app = express();
  app.set('trust proxy', 1);
  app.use((req, _res, next) => {
    req.id = 'request-1';
    next();
  });

  return {
    app,
    logger,
    records: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe('audit logger', () => {
  it('records successful events with only allowlisted safe fields', async () => {
    const { app, logger, records } = auditApp();
    app.post('/transaction', auditEvent('transaction.created', { logger }), (req, res) => {
      req.authUser = { id: ACTOR_ID } as NonNullable<Request['authUser']>;
      setAuditFields(res, {
        householdId: HOUSEHOLD_ID,
        targetUserId: TARGET_ID,
        transactionKind: 'expense',
        email: 'person@example.com',
        amount: 12345,
      } as AuditFields);
      res.status(201).send();
    });

    await request(app).post('/transaction').expect(201);

    expect(records()).toHaveLength(1);
    expect(records()[0]).toMatchObject({
      category: 'audit',
      level: 'info',
      event: 'transaction.created',
      outcome: 'success',
      requestId: 'request-1',
      actorUserId: ACTOR_ID,
      targetUserId: TARGET_ID,
      householdId: HOUSEHOLD_ID,
      transactionKind: 'expense',
    });
    expect(records()[0]).not.toHaveProperty('email');
    expect(records()[0]).not.toHaveProperty('amount');
    expect(records()[0]).not.toHaveProperty('ip');
    expect(records()[0]).not.toHaveProperty('userAgent');
  });

  it('maps denied and failed responses to warning and error records', async () => {
    const { app, logger, records } = auditApp();
    app.post('/denied', auditEvent('source.deleted', { logger }), (_req, res) => {
      res.locals.logErrorCode = 'AUTHORIZATION_ERROR';
      res.locals.logErrorReason = 'NOT_AUTHORIZED';
      res.status(403).send();
    });
    app.post('/failed', auditEvent('source.deleted', { logger }), (_req, res) => {
      res.locals.logErrorCode = 'INTERNAL_ERROR';
      res.locals.logErrorReason = 'INTERNAL_ERROR';
      res.status(500).send();
    });

    await request(app).post('/denied').expect(403);
    await request(app).post('/failed').expect(500);

    expect(records()).toEqual([
      expect.objectContaining({
        level: 'warn',
        event: 'source.deleted',
        outcome: 'denied',
        code: 'AUTHORIZATION_ERROR',
        reason: 'NOT_AUTHORIZED',
      }),
      expect.objectContaining({
        level: 'error',
        event: 'source.deleted',
        outcome: 'failure',
        code: 'INTERNAL_ERROR',
        reason: 'INTERNAL_ERROR',
      }),
    ]);
  });

  it('adds IP and a bounded user agent only when explicitly enabled', async () => {
    const { app, logger, records } = auditApp();
    app.post(
      '/login',
      auditEvent('auth.login', { includeSecurityContext: true, logger }),
      (_req, res) => res.status(200).send(),
    );

    await request(app)
      .post('/login')
      .set('x-forwarded-for', '203.0.113.10')
      .set('user-agent', 'a'.repeat(600))
      .expect(200);

    expect(records()[0]).toMatchObject({
      ip: '203.0.113.10',
      userAgent: 'a'.repeat(512),
    });
  });

  it('audits standalone rate limits without duplicating declared route events', async () => {
    const { app, logger, records } = auditApp();
    const handler = createAuditRateLimitHandler(logger);
    const reject = (
      req: Request,
      res: Parameters<typeof handler>[1],
      next: Parameters<typeof handler>[2],
    ) =>
      handler(req, res, next, {
        statusCode: 429,
        message: { error: { code: 'RATE_LIMITED', reason: 'RATE_LIMITED' } },
      } as Parameters<typeof handler>[3]);

    app.get('/standalone', reject);
    app.get('/declared', auditEvent('auth.login', { logger }), reject);

    await request(app).get('/standalone').set('user-agent', 'rate-limit-test').expect(429);
    await request(app).get('/declared').expect(429);

    expect(records()).toEqual([
      expect.objectContaining({
        level: 'warn',
        event: 'security.rate_limited',
        outcome: 'denied',
        code: 'RATE_LIMITED',
        ip: expect.any(String),
        userAgent: 'rate-limit-test',
      }),
      expect.objectContaining({
        level: 'warn',
        event: 'auth.login',
        outcome: 'denied',
        code: 'RATE_LIMITED',
      }),
    ]);
  });
});

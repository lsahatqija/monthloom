import express, { type Express, type Request } from 'express';
import type { DestinationStream } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createHttpLogger } from '../../src/infrastructure/logging/http-logger.js';

function loggedApp(): { app: Express; records: () => Array<Record<string, unknown>> } {
  const lines: string[] = [];
  const destination: DestinationStream = {
    write: (message) => lines.push(message),
  };
  const middleware = createHttpLogger(destination);
  middleware.logger.level = 'info';

  const app = express();
  app.use(middleware);
  return {
    app,
    records: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe('HTTP logger', () => {
  it('records a safe route template, request ID, duration, and authenticated user ID', async () => {
    const { app, records } = loggedApp();
    app.post('/api/v1/households/invitations/:token/accept', (req, res) => {
      req.authUser = { id: 'user-1' } as NonNullable<Request['authUser']>;
      res.status(200).json({ ok: true });
    });

    await request(app)
      .post('/api/v1/households/invitations/raw-secret-token/accept?email=person@example.com')
      .set('x-request-id', 'safe-request_123')
      .expect('x-request-id', 'safe-request_123')
      .expect(200);

    expect(records()).toHaveLength(1);
    expect(records()[0]).toMatchObject({
      category: 'http',
      level: 'info',
      requestId: 'safe-request_123',
      actorUserId: 'user-1',
      method: 'POST',
      route: '/api/v1/households/invitations/:token/accept',
      statusCode: 200,
    });
    expect(records()[0]!.durationMs).toEqual(expect.any(Number));
    expect(JSON.stringify(records()[0])).not.toContain('raw-secret-token');
    expect(JSON.stringify(records()[0])).not.toContain('person@example.com');
  });

  it('uses a constant route for unmatched requests and rejects unsafe request IDs', async () => {
    const { app, records } = loggedApp();
    app.use((_req, res) => res.status(404).send());

    const response = await request(app)
      .get('/missing/raw-secret-token?token=query-secret')
      .set('x-request-id', 'person@example.com')
      .expect(404);

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(records()[0]).toMatchObject({
      level: 'info',
      route: '<unmatched>',
      statusCode: 404,
    });
    expect(JSON.stringify(records()[0])).not.toContain('raw-secret-token');
    expect(JSON.stringify(records()[0])).not.toContain('query-secret');
    expect(JSON.stringify(records()[0])).not.toContain('person@example.com');
  });

  it('applies the approved HTTP severity mapping', async () => {
    const { app, records } = loggedApp();
    app.get('/bad-request', (_req, res) => res.status(400).send());
    app.get('/unauthorized', (_req, res) => res.status(401).send());
    app.get('/forbidden', (_req, res) => res.status(403).send());
    app.get('/ordinary-conflict', (_req, res) => res.status(409).send());
    app.get('/sensitive-conflict', (_req, res) => {
      res.locals.logErrorReason = 'EMAIL_ALREADY_REGISTERED';
      res.status(409).send();
    });
    app.get('/limited', (_req, res) => res.status(429).send());
    app.get('/failed', (_req, res) => res.status(500).send());

    await request(app).get('/bad-request').expect(400);
    await request(app).get('/unauthorized').expect(401);
    await request(app).get('/forbidden').expect(403);
    await request(app).get('/ordinary-conflict').expect(409);
    await request(app).get('/sensitive-conflict').expect(409);
    await request(app).get('/limited').expect(429);
    await request(app).get('/failed').expect(500);

    expect(Object.fromEntries(records().map((record) => [record.route, record.level]))).toEqual({
      '/bad-request': 'info',
      '/unauthorized': 'warn',
      '/forbidden': 'warn',
      '/ordinary-conflict': 'info',
      '/sensitive-conflict': 'warn',
      '/limited': 'warn',
      '/failed': 'error',
    });
    expect(records().find((record) => record.route === '/failed')).not.toHaveProperty('err');
  });

  it('suppresses successful health probes but records failed readiness', async () => {
    const { app, records } = loggedApp();
    app.get('/health/live', (_req, res) => res.status(200).json({ status: 'ok' }));
    app.get('/health/ready', (_req, res) => res.status(503).json({ status: 'unavailable' }));

    await request(app).get('/health/live').expect(200);
    await request(app).get('/health/ready').expect(503);

    expect(records()).toHaveLength(1);
    expect(records()[0]).toMatchObject({
      level: 'error',
      route: '/health/ready',
      statusCode: 503,
    });
  });
});

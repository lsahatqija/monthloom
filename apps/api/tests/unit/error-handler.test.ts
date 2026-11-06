import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { errorLog } = vi.hoisted(() => ({ errorLog: vi.fn() }));

vi.mock('../../src/infrastructure/logging/logger.js', () => ({
  logger: { error: errorLog },
}));

import { errorHandler } from '../../src/middleware/error-handler.middleware.js';

describe('operational error logging', () => {
  beforeEach(() => errorLog.mockReset());

  it('retains the request ID for an unexpected database failure without request data', async () => {
    const databaseError = new Error('Database operation failed');
    const app = express();
    app.use((req, _res, next) => {
      req.id = 'request-1';
      next();
    });
    app.post('/database-failure', express.json(), (_req, _res, next) => next(databaseError));
    app.use(errorHandler);

    await request(app)
      .post('/database-failure')
      .send({ email: 'private@example.com', name: 'Private name' })
      .expect(500);

    expect(errorLog).toHaveBeenCalledWith(
      { err: databaseError, requestId: 'request-1' },
      'Unhandled error',
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('private@example.com');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('Private name');
  });
});

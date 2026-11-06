import { access } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { config } from '../../src/config/index.js';
import { createCategoryLogger, logger } from '../../src/infrastructure/logging/logger.js';

function captureRecords() {
  const lines: string[] = [];
  return {
    destination: { write: (message: string) => lines.push(message) },
    records: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe('structured logger', () => {
  it('writes the approved base schema with an ISO UTC timestamp and named severity', () => {
    const capture = captureRecords();
    const testLogger = createCategoryLogger('system', capture.destination);
    testLogger.level = 'info';

    testLogger.info({ requestId: 'request-1' }, 'Server event');

    expect(capture.records()).toEqual([
      expect.objectContaining({
        schemaVersion: 1,
        service: 'api',
        category: 'system',
        level: 'info',
        requestId: 'request-1',
        msg: 'Server event',
      }),
    ]);
    expect(capture.records()[0]!.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('redacts header secrets and sensitive fields at supported boundaries', () => {
    const capture = captureRecords();
    const testLogger = createCategoryLogger('system', capture.destination);
    testLogger.level = 'info';

    testLogger.info({
      req: { headers: { cookie: 'session=secret', authorization: 'Bearer secret' } },
      res: { headers: { 'set-cookie': 'session=secret' } },
      password: 'top-level-password',
      credentials: {
        currentPassword: 'old-password',
        token: 'secret-token',
        apiKey: 'secret-key',
      },
    });

    expect(capture.records()[0]).toMatchObject({
      req: { headers: { cookie: '[REDACTED]', authorization: '[REDACTED]' } },
      res: { headers: { 'set-cookie': '[REDACTED]' } },
      password: '[REDACTED]',
      credentials: {
        currentPassword: '[REDACTED]',
        token: '[REDACTED]',
        apiKey: '[REDACTED]',
      },
    });
  });

  it('uses a discard destination in the test environment', async () => {
    expect(config.env).toBe('test');
    logger.info('This record must not create a file');

    await expect(access(path.resolve(config.logging.directory))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('keeps log categories explicit', () => {
    const capture = captureRecords();
    const testLogger = createCategoryLogger('audit', capture.destination);
    testLogger.level = 'info';

    testLogger.info('Audit event');

    expect(capture.records()[0]).toMatchObject({ category: 'audit' });
  });
});

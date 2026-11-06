import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileAdminLogReader } from '../../src/modules/admin/admin-log-reader.js';
import type { AdminRepository } from '../../src/modules/admin/admin.repository.js';
import { AdminService } from '../../src/modules/admin/admin.service.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('admin dashboard', () => {
  it('aggregates real metrics and derives health from recent severe logs', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'monthloom-admin-'));
    temporaryDirectories.push(directory);
    await writeFile(
      path.join(directory, 'server.2026-11-06.log'),
      [
        JSON.stringify({
          time: '2026-11-06T09:00:00.000Z',
          level: 'warn',
          category: 'http',
          msg: 'request completed',
          method: 'POST',
          route: '/api/v1/auth/login',
          statusCode: 429,
        }),
        JSON.stringify({
          time: '2026-11-06T10:00:00.000Z',
          level: 'error',
          category: 'http',
          msg: 'Request failed',
          req: { method: 'GET', url: '/api/v1/households' },
          res: { statusCode: 500 },
        }),
        '{not-json}',
      ].join('\n'),
    );

    const repository: AdminRepository = {
      getMetrics: vi.fn().mockResolvedValue({
        totalUsers: 12,
        activeUsers: 4,
        households: 7,
        incomes: 20,
        expenses: 31,
      }),
    };
    const service = new AdminService(repository, new FileAdminLogReader(directory));

    const result = await service.getDashboard(new Date('2026-11-06T12:00:00.000Z'));

    expect(result.metrics).toMatchObject({ transactions: 51, totalUsers: 12, activeUsers: 4 });
    expect(result.health).toMatchObject({
      status: 'degraded',
      loggingAvailable: true,
      counts: { warn: 1, error: 1, fatal: 0 },
      last24Hours: { warn: 1, error: 1, fatal: 0 },
    });
    expect(result.health.entries[0]).toMatchObject({
      level: 'error',
      detail: 'GET /api/v1/households · 500',
    });
    expect(result.health.entries[1]).toMatchObject({
      level: 'warn',
      detail: 'POST /api/v1/auth/login · 429',
    });
  });

  it('reports logging as unavailable when the log directory cannot be read', async () => {
    const repository: AdminRepository = {
      getMetrics: vi.fn().mockResolvedValue({
        totalUsers: 0,
        activeUsers: 0,
        households: 0,
        incomes: 0,
        expenses: 0,
      }),
    };
    const service = new AdminService(repository, new FileAdminLogReader('missing-log-directory'));

    expect((await service.getDashboard()).health.status).toBe('unavailable');
  });
});

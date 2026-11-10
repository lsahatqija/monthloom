import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { AdminLogEntry } from '@monthloom/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileAdminLogReader } from '../../src/modules/admin/admin-log-reader.js';
import type { AdminLogReader } from '../../src/modules/admin/admin-log-reader.js';
import type { AdminRepository } from '../../src/modules/admin/admin.repository.js';
import { AdminService } from '../../src/modules/admin/admin.service.js';

const temporaryDirectories: string[] = [];

function repository(): AdminRepository {
  return {
    getMetrics: vi.fn().mockResolvedValue({
      totalUsers: 0,
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      monthlyActiveUsers: 0,
      currentlyLoggedInUsers: 0,
      households: 0,
      incomes: 0,
      expenses: 0,
    }),
  };
}

function logReader(entries: AdminLogEntry[], available = true): AdminLogReader {
  return { read: async () => ({ available, windowDays: 7, entries }) };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('admin dashboard', () => {
  it('resolves ranges and delegates retention and reliability independently', async () => {
    const retention = {
      retention: [],
      cohorts: [],
      dormant: { users30Days: 0, users90Days: 0, households30Days: 0 },
      reactivations: [],
      coverageStartedAt: '2026-01-01T00:00:00.000Z',
    };
    const operational = {
      status: 'unknown' as const,
      lastObservedAt: null,
      detail: 'Not connected',
    };
    const compared = { current: 0, previous: 0, changePercent: 0 };
    const reliability = {
      summary: {
        requests: compared,
        errorRate: compared,
        averageLatencyMs: compared,
        p95LatencyMs: compared,
        databaseAverageMs: compared,
      },
      series: [],
      slowRoutes: [],
      email: operational,
      readiness: operational,
      backgroundJobs: operational,
      backups: operational,
      deployment: { applicationVersion: '0.1.0', clientVersions: [] },
    };
    const analyticsRepository: AdminRepository = {
      ...repository(),
      getRetention: vi.fn().mockResolvedValue(retention),
      getReliability: vi.fn().mockResolvedValue(reliability),
    };
    const service = new AdminService(analyticsRepository, logReader([]));
    const query = { from: '2026-10-01', to: '2026-10-31', timezone: 'UTC' };

    await expect(
      service.getRetention(query, new Date('2026-11-01T00:00:00Z')),
    ).resolves.toMatchObject(retention);
    await expect(
      service.getReliability(query, new Date('2026-11-01T00:00:00Z')),
    ).resolves.toMatchObject(reliability);
    expect(analyticsRepository.getRetention).toHaveBeenCalledOnce();
    expect(analyticsRepository.getReliability).toHaveBeenCalledOnce();
  });
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
        dailyActiveUsers: 4,
        weeklyActiveUsers: 5,
        monthlyActiveUsers: 6,
        currentlyLoggedInUsers: 3,
        households: 7,
        incomes: 20,
        expenses: 31,
      }),
    };
    const service = new AdminService(repository, new FileAdminLogReader(directory));

    const result = await service.getDashboard(new Date('2026-11-06T12:00:00.000Z'));

    expect(result.metrics).toMatchObject({
      transactions: 51,
      totalUsers: 12,
      dailyActiveUsers: 4,
      weeklyActiveUsers: 5,
      monthlyActiveUsers: 6,
      currentlyLoggedInUsers: 3,
    });
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
      statusCode: 429,
      detail: 'POST /api/v1/auth/login · 429',
    });
  });

  it('does not degrade health for expected client and security warnings', async () => {
    const now = new Date('2026-11-06T12:00:00.000Z');
    const entries = [401, 403, 409, 429].map((statusCode) => ({
      timestamp: now.toISOString(),
      level: 'warn' as const,
      category: 'http',
      message: 'Expected request warning',
      statusCode,
    }));

    const result = await new AdminService(repository(), logReader(entries)).getDashboard(now);

    expect(result.health).toMatchObject({ status: 'healthy', last24Hours: { warn: 4 } });
    expect(result.health.entries).toHaveLength(4);
  });

  it('degrades health only after five actionable warnings in 24 hours', async () => {
    const now = new Date('2026-11-06T12:00:00.000Z');
    const warning = (index: number): AdminLogEntry => ({
      timestamp: now.toISOString(),
      level: 'warn',
      category: 'system',
      message: `Actionable warning ${index}`,
      statusCode: 400,
    });

    await expect(
      new AdminService(
        repository(),
        logReader(Array.from({ length: 4 }, (_, index) => warning(index))),
      ).getDashboard(now),
    ).resolves.toMatchObject({ health: { status: 'healthy' } });
    await expect(
      new AdminService(
        repository(),
        logReader(Array.from({ length: 5 }, (_, index) => warning(index))),
      ).getDashboard(now),
    ).resolves.toMatchObject({ health: { status: 'degraded' } });
  });

  it('reports logging as unavailable when the log directory cannot be read', async () => {
    const repository: AdminRepository = {
      getMetrics: vi.fn().mockResolvedValue({
        totalUsers: 0,
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
        currentlyLoggedInUsers: 0,
        households: 0,
        incomes: 0,
        expenses: 0,
      }),
    };
    const service = new AdminService(repository, new FileAdminLogReader('missing-log-directory'));

    expect((await service.getDashboard()).health.status).toBe('unavailable');
  });

  it('uses only the last 24 hours to derive critical health', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'monthloom-admin-'));
    temporaryDirectories.push(directory);
    await writeFile(
      path.join(directory, 'server.2026-11-06.log'),
      [
        JSON.stringify({
          time: '2026-11-05T11:59:59.000Z',
          level: 'fatal',
          category: 'system',
          msg: 'Old process failure',
        }),
        JSON.stringify({
          time: '2026-11-06T11:00:00.000Z',
          level: 'fatal',
          category: 'system',
          msg: 'Recent process failure',
        }),
      ].join('\n'),
    );
    const repository: AdminRepository = {
      getMetrics: vi.fn().mockResolvedValue({
        totalUsers: 0,
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
        currentlyLoggedInUsers: 0,
        households: 0,
        incomes: 0,
        expenses: 0,
      }),
    };

    const result = await new AdminService(
      repository,
      new FileAdminLogReader(directory),
    ).getDashboard(new Date('2026-11-06T12:00:00.000Z'));

    expect(result.health.status).toBe('critical');
    expect(result.health.counts.fatal).toBe(2);
    expect(result.health.last24Hours.fatal).toBe(1);
  });

  it('aggregates every log event before limiting the displayed list', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'monthloom-admin-'));
    temporaryDirectories.push(directory);
    await writeFile(
      path.join(directory, 'server.2026-11-06.log'),
      Array.from({ length: 101 }, (_, index) =>
        JSON.stringify({
          time: `2026-11-06T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
          level: 'error',
          category: 'system',
          msg: `Failure ${index}`,
        }),
      ).join('\n'),
    );
    const repository: AdminRepository = {
      getMetrics: vi.fn().mockResolvedValue({
        totalUsers: 0,
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
        currentlyLoggedInUsers: 0,
        households: 0,
        incomes: 0,
        expenses: 0,
      }),
    };

    const result = await new AdminService(
      repository,
      new FileAdminLogReader(directory, 3),
    ).getDashboard(new Date('2026-11-06T23:30:00.000Z'));

    expect(result.health.windowDays).toBe(3);
    expect(result.health.counts.error).toBe(101);
    expect(result.health.last24Hours.error).toBe(101);
    expect(result.health.entries).toHaveLength(100);
  });

  it('keeps readable log files when one file cannot be read', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'monthloom-admin-'));
    temporaryDirectories.push(directory);
    await writeFile(
      path.join(directory, 'server.2026-11-06.log'),
      JSON.stringify({
        time: '2026-11-06T11:00:00.000Z',
        level: 'warn',
        category: 'system',
        msg: 'Readable warning',
      }),
    );
    await mkdir(path.join(directory, 'server.2026-11-05.log'));

    const result = await new FileAdminLogReader(directory).read();

    expect(result).toMatchObject({ available: false, entries: [{ message: 'Readable warning' }] });
  });
});

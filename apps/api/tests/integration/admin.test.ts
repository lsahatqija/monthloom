import {
  adminDashboardResponseSchema,
  adminHealthResponseSchema,
  adminOverviewResponseSchema,
} from '@monthloom/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { db, pool } from '../../src/infrastructure/database/client.js';
import { PostgresAdminRepository } from '../../src/modules/admin/adapters/postgres-admin.repository.js';
import { api, app, register } from '../http.js';

describe('admin dashboard HTTP + PostgreSQL', () => {
  it('rejects regular users and returns application metrics to admins', async () => {
    await request(app).get(`${api}/admin/dashboard`).expect(401);

    const { agent, user } = await register();
    await agent.get(`${api}/admin/dashboard`).expect(403);

    const { pool } = await import('../../src/infrastructure/database/client.js');
    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [user.id]);

    const response = await agent.get(`${api}/admin/dashboard`).expect(200);
    const dashboard = adminDashboardResponseSchema.parse(response.body);
    const overview = adminOverviewResponseSchema.parse(
      (await agent.get(`${api}/admin/overview`).expect(200)).body,
    );
    const health = adminHealthResponseSchema.parse(
      (await agent.get(`${api}/admin/health`).expect(200)).body,
    );

    expect(dashboard.metrics).toMatchObject({
      totalUsers: 1,
      dailyActiveUsers: 1,
      weeklyActiveUsers: 1,
      monthlyActiveUsers: 1,
      currentlyLoggedInUsers: 1,
      households: 0,
      transactions: 0,
    });
    expect(dashboard.health.status).toBe('unavailable');
    expect(overview.metrics).toEqual(dashboard.metrics);
    expect(health.health.status).toBe(dashboard.health.status);
  });

  it('counts distinct activity windows separately from valid sessions', async () => {
    const [daily, dailyBoundary, weekly, monthly, inactive] = await Promise.all([
      register(),
      register(),
      register(),
      register(),
      register(),
    ]);
    const now = new Date('2026-11-09T12:00:00.000Z');
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1_000);

    await Promise.all([
      pool.query('UPDATE users SET last_active_at = $2 WHERE id = $1', [
        daily.user.id,
        new Date(now.getTime() - 60 * 60 * 1_000),
      ]),
      pool.query('UPDATE users SET last_active_at = $2 WHERE id = $1', [
        dailyBoundary.user.id,
        dayAgo,
      ]),
      pool.query('UPDATE users SET last_active_at = $2 WHERE id = $1', [
        weekly.user.id,
        new Date(now.getTime() - 2 * 24 * 60 * 60 * 1_000),
      ]),
      pool.query('UPDATE users SET last_active_at = $2 WHERE id = $1', [
        monthly.user.id,
        new Date(now.getTime() - 29 * 24 * 60 * 60 * 1_000),
      ]),
      pool.query('UPDATE users SET last_active_at = $2 WHERE id = $1', [
        inactive.user.id,
        new Date(now.getTime() - 31 * 24 * 60 * 60 * 1_000),
      ]),
      pool.query('UPDATE sessions SET revoked_at = $2 WHERE user_id = $1', [weekly.user.id, now]),
      pool.query('UPDATE sessions SET expires_at = $2 WHERE user_id = $1', [
        monthly.user.id,
        new Date(now.getTime() - 1),
      ]),
      pool.query('UPDATE sessions SET revoked_at = $2 WHERE user_id = $1', [inactive.user.id, now]),
      pool.query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
        daily.user.id,
        'a'.repeat(64),
        new Date(now.getTime() + 24 * 60 * 60 * 1_000),
      ]),
    ]);

    await expect(new PostgresAdminRepository(db).getMetrics(now)).resolves.toMatchObject({
      totalUsers: 5,
      dailyActiveUsers: 2,
      weeklyActiveUsers: 3,
      monthlyActiveUsers: 4,
      currentlyLoggedInUsers: 2,
    });
  });
});

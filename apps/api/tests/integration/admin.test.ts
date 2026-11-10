import {
  adminDashboardResponseSchema,
  adminAdoptionResponseSchema,
  adminHealthResponseSchema,
  adminOverviewResponseSchema,
  adminReliabilityResponseSchema,
  adminRetentionResponseSchema,
  adminUsageResponseSchema,
} from '@monthloom/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { db, pool } from '../../src/infrastructure/database/client.js';
import { PostgresAdminRepository } from '../../src/modules/admin/adapters/postgres-admin.repository.js';
import { resolveAdminAnalyticsRange } from '../../src/modules/admin/admin-range.js';
import { api, app, household, register } from '../http.js';

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

  it('records append-only product events and returns range-aware usage', async () => {
    const owner = await register();
    const householdId = await household(owner.agent);
    const source = await owner.agent
      .post(`${api}/households/${householdId}/sources`)
      .send({ displayName: 'Usage source', aliases: [] })
      .expect(201);
    const created = await owner.agent
      .post(`${api}/households/${householdId}/transactions`)
      .send({
        kind: 'expense',
        type: 'groceries',
        date: '2026-11-09',
        sourceId: source.body.source.id,
        icon: 'shopping-cart',
        color: '#123456',
        amount: '12.34',
        userId: owner.user.id,
        recurring: false,
        expiresOn: null,
      })
      .expect(201);

    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [owner.user.id]);
    const today = new Date().toISOString().slice(0, 10);
    const ranges = resolveAdminAnalyticsRange({ from: today, to: today, timezone: 'UTC' });
    await new PostgresAdminRepository(db).getUsage(ranges.range, ranges.comparisonRange);
    const response = await owner.agent
      .get(`${api}/admin/usage?from=${today}&to=${today}&timezone=UTC`)
      .expect(200);
    const usage = adminUsageResponseSchema.parse(response.body);

    expect(usage.summary.transactionsCreated.current).toBe(1);
    expect(usage.series[0]).toMatchObject({
      dailyActiveUsers: expect.any(Number),
      weeklyActiveUsers: expect.any(Number),
      monthlyActiveUsers: expect.any(Number),
    });
    expect(usage.transactionMix.operations.created).toBe(1);
    expect(usage.transactionMix.kinds).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'expense', count: 1 })]),
    );
    expect(usage.transactionMix.currencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'EUR', kind: 'expense', amount: '12.34' }),
      ]),
    );

    await expect(
      pool.query(`DELETE FROM product_events WHERE subject_id = $1`, [created.body.transaction.id]),
    ).rejects.toThrow('append-only');
  });

  it('reports registration, first-value, and invitation adoption cohorts', async () => {
    const administrator = await register();
    const householdId = await household(administrator.agent);
    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [administrator.user.id]);
    const newcomer = await register();
    const invitation = await administrator.agent
      .post(`${api}/households/${householdId}/invitations`)
      .send({ mode: 'link' })
      .expect(201);
    await newcomer.agent
      .post(`${api}/households/invitations/${invitation.body.token}/accept`)
      .expect(200);
    const source = await administrator.agent
      .post(`${api}/households/${householdId}/sources`)
      .send({ displayName: 'Adoption source', aliases: [] })
      .expect(201);
    await administrator.agent
      .post(`${api}/households/${householdId}/transactions`)
      .send({
        kind: 'income',
        type: 'income',
        date: '2026-11-09',
        sourceId: source.body.source.id,
        icon: 'banknote',
        color: '#123456',
        amount: '25.00',
        userId: newcomer.user.id,
        recurring: false,
        expiresOn: null,
      })
      .expect(201);
    await register();

    const today = new Date().toISOString().slice(0, 10);
    const response = await administrator.agent
      .get(`${api}/admin/adoption?from=${today}&to=${today}&timezone=UTC`)
      .expect(200);
    const adoption = adminAdoptionResponseSchema.parse(response.body);

    expect(adoption.registrations.current).toBe(2);
    expect(adoption.usersWithoutHousehold).toBeGreaterThanOrEqual(1);
    expect(adoption.timeToFirstHousehold).toMatchObject({ converted: 1, notConverted: 1 });
    expect(adoption.timeToFirstTransaction).toMatchObject({ converted: 1, notConverted: 1 });
    expect(adoption.invitations).toMatchObject({ sent: 1, accepted: 1, conversionRate: 100 });

    const retentionRanges = resolveAdminAnalyticsRange({ from: today, to: today, timezone: 'UTC' });
    await new PostgresAdminRepository(db).getRetention!(
      retentionRanges.range,
      retentionRanges.comparisonRange,
    );
    const retention = adminRetentionResponseSchema.parse(
      (
        await administrator.agent
          .get(`${api}/admin/retention?from=${today}&to=${today}&timezone=UTC`)
          .expect(200)
      ).body,
    );
    expect(retention.retention).toHaveLength(3);

    await pool.query(
      `INSERT INTO application_deployments (version, deployed_at) VALUES ('test-v2', $1) ON CONFLICT DO NOTHING`,
      [new Date(`${today}T00:00:00.000Z`)],
    );
    const reliability = adminReliabilityResponseSchema.parse(
      (
        await administrator.agent
          .get(`${api}/admin/reliability?from=${today}&to=${today}&timezone=UTC`)
          .expect(200)
      ).body,
    );
    expect(reliability.summary.requests.current).toBeGreaterThanOrEqual(0);
    expect(reliability.deployment.history).toEqual(
      expect.arrayContaining([expect.objectContaining({ version: 'test-v2' })]),
    );
  });
});

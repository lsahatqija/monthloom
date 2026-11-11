import {
  adminDashboardResponseSchema,
  adminAdoptionResponseSchema,
  adminHealthResponseSchema,
  adminOverviewResponseSchema,
  adminReliabilityResponseSchema,
  adminRetentionResponseSchema,
  adminSecurityResponseSchema,
  adminUsageResponseSchema,
} from '@monthloom/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { db, pool } from '../../src/infrastructure/database/client.js';
import { PostgresAdminRepository } from '../../src/modules/admin/adapters/postgres-admin.repository.js';
import { resolveAdminAnalyticsRange } from '../../src/modules/admin/admin-range.js';
import { api, app, household, password, register } from '../http.js';

describe('admin dashboard HTTP + PostgreSQL', () => {
  const analyticsEndpoints = ['usage', 'adoption', 'retention', 'reliability', 'security'] as const;

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

  it('protects every analytics endpoint and rejects invalid ranges', async () => {
    const { agent, user } = await register();

    for (const endpoint of analyticsEndpoints) {
      await request(app).get(`${api}/admin/${endpoint}`).expect(401);
      await agent.get(`${api}/admin/${endpoint}`).expect(403);
    }

    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [user.id]);
    for (const endpoint of analyticsEndpoints) {
      await agent
        .get(`${api}/admin/${endpoint}?from=2026-02-02&to=2026-02-01&timezone=UTC`)
        .expect(400);
      await agent
        .get(`${api}/admin/${endpoint}?from=2025-01-01&to=2026-01-02&timezone=UTC`)
        .expect(400);
    }
  });

  it('blocks a provisioned administrator until the initial password is replaced', async () => {
    const { agent, user } = await register();
    await pool.query(
      `UPDATE users SET role = 'admin', must_change_password = true WHERE id = $1`,
      [user.id],
    );

    await agent.get(`${api}/admin/overview`).expect(403);
    await agent
      .put(`${api}/auth/initial-password`)
      .send({
        currentPassword: password,
        newPassword: 'Replacement-password-123!',
        confirmNewPassword: 'Replacement-password-123!',
      })
      .expect(204);
    await agent.get(`${api}/admin/overview`).expect(200);

    const result = await pool.query(`SELECT must_change_password FROM users WHERE id = $1`, [
      user.id,
    ]);
    expect(result.rows[0]?.must_change_password).toBe(false);
  });

  it('keeps bounded analytics range queries backed by time indexes', async () => {
    await pool.query('SET enable_seqscan = off');
    try {
      const eventsPlan = await pool.query(
        `EXPLAIN (FORMAT JSON) SELECT * FROM product_events
         WHERE event_name = 'user.active' AND occurred_at >= now() - interval '30 days'`,
      );
      const rollupsPlan = await pool.query(
        `EXPLAIN (FORMAT JSON) SELECT * FROM request_hourly_rollups
         WHERE hour >= now() - interval '30 days'`,
      );
      expect(JSON.stringify(eventsPlan.rows)).toMatch(
        /product_events_(event_occurred|daily_activity_unique)_idx/,
      );
      expect(JSON.stringify(rollupsPlan.rows)).toContain('request_hourly_rollups_range_idx');
    } finally {
      await pool.query('RESET enable_seqscan');
    }
  });

  it('returns continuous empty analytics and collection coverage metadata', async () => {
    const { agent, user } = await register();
    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [user.id]);

    const usage = adminUsageResponseSchema.parse(
      (await agent.get(`${api}/admin/usage?from=2000-01-01&to=2000-01-03&timezone=UTC`).expect(200))
        .body,
    );
    const retention = adminRetentionResponseSchema.parse(
      (
        await agent
          .get(`${api}/admin/retention?from=2000-01-01&to=2000-01-03&timezone=UTC`)
          .expect(200)
      ).body,
    );

    expect(usage.series).toHaveLength(3);
    expect(usage.series.every((bucket) => bucket.activeUsers === 0)).toBe(true);
    expect(usage.coverageStartedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(retention.reactivations).toHaveLength(3);
    expect(retention.retention.every((metric) => metric.rate === null)).toBe(true);
    expect(retention.coverageStartedAt).toBe(usage.coverageStartedAt);
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

  it('returns aggregate-only security data and suspends accounts with session revocation', async () => {
    const administrator = await register();
    const target = await register();
    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [administrator.user.id]);
    const now = new Date();
    await pool.query(
      `INSERT INTO product_events (event_name, occurred_at, metadata) VALUES
        ('auth.login.failed', $1, '{}'),
        ('auth.login.succeeded', $1, '{}'),
        ('security.rate_limited', $1, $2),
        ('security.rate_limited', $1, $2),
        ('security.rate_limited', $1, $2)`,
      [now, JSON.stringify({ clientKey: 'a'.repeat(64), routeGroup: '/auth' })],
    );
    const today = now.toISOString().slice(0, 10);
    const response = await administrator.agent
      .get(`${api}/admin/security?from=${today}&to=${today}&timezone=UTC`)
      .expect(200);
    const security = adminSecurityResponseSchema.parse(response.body);
    expect(security.summary.failedLogins.current).toBe(1);
    expect(security.summary.rateLimitedRequests.current).toBe(3);
    expect(security.rateLimitRoutes).toContainEqual({
      route: '/auth',
      requests: 3,
      affectedClients: 1,
      repeatedClients: 1,
    });
    expect(JSON.stringify(response.body)).not.toContain('a'.repeat(64));
    expect(JSON.stringify(response.body)).not.toContain('clientKey');

    await administrator.agent.post(`${api}/admin/users/${target.user.id}/suspend`).expect(200);
    await target.agent.get(`${api}/users/me`).expect(401);
    const state = await pool.query(
      `SELECT u.suspended_at, s.revoked_at,
        EXISTS (SELECT 1 FROM product_events e WHERE e.event_name = 'account.suspended'
          AND e.actor_user_id = $2 AND e.subject_id = $1) AS audited
       FROM users u JOIN sessions s ON s.user_id = u.id WHERE u.id = $1 LIMIT 1`,
      [target.user.id, administrator.user.id],
    );
    expect(state.rows[0]).toMatchObject({ audited: true });
    expect(state.rows[0].suspended_at).toBeTruthy();
    expect(state.rows[0].revoked_at).toBeTruthy();
  });
});

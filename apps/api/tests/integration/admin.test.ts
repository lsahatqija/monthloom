import { adminDashboardResponseSchema } from '@monthloom/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

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

    expect(dashboard.metrics).toMatchObject({
      totalUsers: 1,
      activeUsers: 1,
      households: 0,
      transactions: 0,
    });
    expect(dashboard.health.status).toBe('unavailable');
  });
});

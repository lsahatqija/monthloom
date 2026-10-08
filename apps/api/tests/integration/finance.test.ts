import { householdMonthResponseSchema } from '@template/contracts';
import { describe, expect, it, vi } from 'vitest';

import { pool } from '../../src/infrastructure/database/client.js';
import { api, household, register } from '../http.js';

describe('finance HTTP + PostgreSQL', () => {
  async function fixture() {
    const owner = await register();
    const id = await household(owner.agent);
    const base = `${api}/households/${id}`;
    const source = await owner.agent
      .post(`${base}/sources`)
      .send({ displayName: 'Shop', aliases: ['Market'] })
      .expect(201);
    const transaction = {
      kind: 'expense',
      type: 'groceries',
      date: '2026-01-31',
      sourceId: source.body.source.id,
      icon: 'shopping-cart',
      color: '#123456',
      amount: '12.34',
      userId: owner.user.id,
      recurring: false,
      expiresOn: null,
    };
    return { ...owner, id, base, transaction };
  }

  it('creates, edits and removes transactions and returns validated monthly totals', async () => {
    const { agent, base, transaction } = await fixture();
    const expense = await agent.post(`${base}/transactions`).send(transaction).expect(201);
    await agent
      .post(`${base}/transactions`)
      .send({ ...transaction, kind: 'income', type: null, amount: '100.00' })
      .expect(201);
    const month = await agent.get(`${base}/month?month=2026-01`).expect(200);
    expect(householdMonthResponseSchema.parse(month.body).summary).toEqual({
      income: '100.00',
      expenses: '12.34',
      leftover: '87.66',
    });
    const entryUrl = `${base}/transactions/${expense.body.transaction.id}`;
    await agent
      .patch(entryUrl)
      .send({
        transaction: { ...transaction, amount: '20.00' },
        selection: { past: false, current: true, future: false },
      })
      .expect(200);
    expect((await agent.get(`${base}/month?month=2026-01`)).body.summary.expenses).toBe('20.00');
    await agent.delete(`${base}/sources/${transaction.sourceId}`).expect(409);
    await agent.delete(`${entryUrl}?scope=current`).expect(204);
    expect((await agent.get(`${base}/month?month=2026-01`)).body.summary.expenses).toBe('0.00');
  });

  it('projects recurring entries across short months and stops at their expiration', async () => {
    // Fake only Date so database sockets and HTTP timers continue to work normally.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    try {
      const { agent, base, transaction } = await fixture();
      await agent
        .post(`${base}/transactions`)
        .send({ ...transaction, recurring: true, expiresOn: '2026-02-28' })
        .expect(201);
      const february = await agent.get(`${base}/month?month=2026-02`).expect(200);
      expect(february.body.transactions).toHaveLength(1);
      expect(february.body.transactions[0]).toMatchObject({
        date: '2026-02-28',
        projected: true,
        amount: '12.34',
      });
      const march = await agent.get(`${base}/month?month=2026-03`).expect(200);
      expect(march.body.transactions).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('isolates household data and refuses transactions assigned to outsiders', async () => {
    const { agent, base, transaction } = await fixture();
    const outsider = await register();
    await outsider.agent.get(`${base}/month?month=2026-01`).expect(403);
    await outsider.agent.post(`${base}/transactions`).send(transaction).expect(403);
    await outsider.agent.delete(base).expect(403);
    await agent
      .post(`${base}/transactions`)
      .send({ ...transaction, userId: outsider.user.id })
      .expect(403);
    const otherHousehold = await household(agent);
    await agent
      .post(`${api}/households/${otherHousehold}/transactions`)
      .send(transaction)
      .expect(404);
  });

  async function recurringSeries() {
    const context = await fixture();
    const ids: string[] = [];
    for (const date of ['2026-01-31', '2026-02-28', '2026-03-31']) {
      const response = await context.agent
        .post(`${context.base}/transactions`)
        .send({ ...context.transaction, date, recurring: true })
        .expect(201);
      ids.push(response.body.transaction.id);
    }
    // Seed historical occurrences of one series; the HTTP create endpoint starts a new series each time.
    await pool.query(
      'UPDATE expenses SET recurrence_id = (SELECT recurrence_id FROM expenses WHERE id = $1) WHERE id = ANY($2::uuid[])',
      [ids[0], ids],
    );
    return { ...context, ids };
  }

  it.each([
    { past: false, current: true, future: false },
    { past: false, current: true, future: true },
    { past: true, current: true, future: true },
  ])('edits only the selected recurring occurrences: %j', async (selection) => {
    const { agent, base, transaction, ids } = await recurringSeries();
    await agent
      .patch(`${base}/transactions/${ids[1]}`)
      .send({
        selection,
        transaction: { ...transaction, date: '2026-02-28', amount: '30.00', recurring: true },
      })
      .expect(200);
    const rows = await pool.query(
      'SELECT amount FROM expenses WHERE id = ANY($1::uuid[]) ORDER BY date',
      [ids],
    );
    expect(rows.rows.map((row) => row.amount)).toEqual([
      selection.past ? '30.00' : '12.34',
      '30.00',
      selection.future ? '30.00' : '12.34',
    ]);
  });

  it.each([
    ['current', 2],
    ['current_and_future', 1],
    ['past_current_and_future', 0],
  ] as const)('deletes a recurring series with scope %s', async (scope, remaining) => {
    const { agent, base, ids } = await recurringSeries();
    await agent.delete(`${base}/transactions/${ids[1]}?scope=${scope}`).expect(204);
    const rows = await pool.query('SELECT id FROM expenses WHERE id = ANY($1::uuid[])', [ids]);
    expect(rows.rowCount).toBe(remaining);
  });

  it('normalizes duplicate sources and copies them without duplicating the target', async () => {
    const { agent, base, transaction } = await fixture();
    await agent.post(`${base}/sources`).send({ displayName: ' SHOP ', aliases: [] }).expect(409);
    const targetHouseholdId = await household(agent);
    const body = { targetHouseholdId, sourceIds: [transaction.sourceId] };
    expect((await agent.post(`${base}/sources/copy`).send(body).expect(201)).body).toEqual({
      copiedCount: 1,
      skippedCount: 0,
    });
    expect((await agent.post(`${base}/sources/copy`).send(body).expect(201)).body).toEqual({
      copiedCount: 0,
      skippedCount: 1,
    });
  });

  it('accepts a single-use invitation and transfers ownership when the owner leaves', async () => {
    const { agent, base, id } = await fixture();
    const invitee = await register();
    const invitation = await agent.post(`${base}/invitations`).send({ mode: 'link' }).expect(201);
    const acceptUrl = `${api}/households/invitations/${invitation.body.token}/accept`;
    await invitee.agent.post(acceptUrl).expect(200);
    await invitee.agent.post(acceptUrl).expect(404);
    await invitee.agent.delete(base).expect(403);
    await agent.post(`${base}/leave`).send({}).expect(409);
    await agent.post(`${base}/leave`).send({ newOwnerId: invitee.user.id }).expect(204);
    await agent.get(`${base}/month?month=2026-01`).expect(403);
    const listing = await invitee.agent.get(`${api}/households`).expect(200);
    expect(listing.body.households.find((entry: { id: string }) => entry.id === id).ownerId).toBe(
      invitee.user.id,
    );
    await invitee.agent.delete(base).expect(204);
  });
});

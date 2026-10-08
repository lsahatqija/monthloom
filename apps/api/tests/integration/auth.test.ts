import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { pool } from '../../src/infrastructure/database/client.js';
import { AutomatedEmailService } from '../../src/modules/email/automated-email.service.js';
import { api, app, password, register } from '../http.js';

describe('authentication HTTP + PostgreSQL', () => {
  it('registers, persists a hashed password, logs in and revokes a session on logout', async () => {
    const { agent, email, user, response } = await register();
    expect(response.body.user).not.toHaveProperty('passwordHash');
    const sessionCookie = response.get('Set-Cookie')![0]!;
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
    const persisted = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    expect(persisted.rows[0].password_hash).toMatch(/^\$argon2/);
    await agent.get(`${api}/users/me`).expect(200);
    const cookie = sessionCookie.split(';')[0]!;
    await agent.post(`${api}/auth/logout`).expect(204);
    await request(app).get(`${api}/users/me`).set('Cookie', cookie).expect(401);
    await agent
      .post(`${api}/auth/login`)
      .send({ email: email.toUpperCase(), password })
      .expect(200);
    await agent.get(`${api}/users/me`).expect(200);
  });

  it('rejects duplicates, invalid input and incorrect credentials', async () => {
    const { email } = await register();
    await request(app)
      .post(`${api}/auth/register`)
      .send({
        email,
        password,
        displayName: 'Duplicate',
        profileImage: 'diamond-kilim',
        desiredColor: 'indigo',
      })
      .expect(409);
    const invalid = await request(app)
      .post(`${api}/auth/register`)
      .send({ email: 'invalid' })
      .expect(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    const wrong = await request(app)
      .post(`${api}/auth/login`)
      .send({ email, password: 'wrong' })
      .expect(401);
    const missing = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: 'absent@example.com', password })
      .expect(401);
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });

  it('verifies email once, resets the password once and revokes existing sessions', async () => {
    const welcome = vi.spyOn(AutomatedEmailService.prototype, 'sendWelcome').mockResolvedValue();
    const resetEmail = vi
      .spyOn(AutomatedEmailService.prototype, 'sendPasswordReset')
      .mockResolvedValue();
    const { agent, email } = await register();
    const verificationToken = new URL(welcome.mock.calls[0]![0].verificationUrl).pathname
      .split('/')
      .pop();
    await agent.post(`${api}/auth/verify-email`).send({ token: verificationToken }).expect(200);
    await agent.post(`${api}/auth/verify-email`).send({ token: verificationToken }).expect(400);
    await agent.post(`${api}/auth/forgot-password`).send({ email }).expect(202);
    const token = new URL(resetEmail.mock.calls[0]![0].url).pathname.split('/').pop();
    const body = {
      token,
      newPassword: 'New-password-456!',
      confirmNewPassword: 'New-password-456!',
    };
    await request(app).post(`${api}/auth/reset-password`).send(body).expect(204);
    await request(app).post(`${api}/auth/reset-password`).send(body).expect(400);
    await agent.get(`${api}/users/me`).expect(401);
    await agent.post(`${api}/auth/login`).send({ email, password }).expect(401);
    await agent.post(`${api}/auth/login`).send({ email, password: body.newPassword }).expect(200);
  });

  it('rejects an expired session', async () => {
    const { agent, user } = await register();
    await pool.query('UPDATE sessions SET expires_at = $1 WHERE user_id = $2', [
      new Date(0),
      user.id,
    ]);
    await agent.get(`${api}/users/me`).expect(401);
  });
});

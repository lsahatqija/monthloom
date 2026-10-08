import { describe, expect, it } from 'vitest';

import { api, password, register } from '../http.js';

describe('user HTTP + PostgreSQL', () => {
  it('persists profile updates while preventing role escalation', async () => {
    const { agent } = await register();
    await agent
      .patch(`${api}/users/me`)
      .send({
        displayName: 'Updated',
        role: 'admin',
        profileImage: 'diamond-kilim',
        desiredColor: 'indigo',
      })
      .expect(200);
    const response = await agent.get(`${api}/users/me`).expect(200);
    expect(response.body.user).toMatchObject({ displayName: 'Updated', role: 'user' });
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('requires the current password before changing credentials', async () => {
    const { agent, email } = await register();
    const body = {
      currentPassword: 'incorrect',
      newPassword: 'Changed-password-456!',
      confirmNewPassword: 'Changed-password-456!',
    };
    await agent.put(`${api}/users/me/password`).send(body).expect(400);
    await agent
      .put(`${api}/users/me/password`)
      .send({ ...body, currentPassword: password })
      .expect(204);
    await agent.post(`${api}/auth/login`).send({ email, password }).expect(401);
    await agent.post(`${api}/auth/login`).send({ email, password: body.newPassword }).expect(200);
  });
});

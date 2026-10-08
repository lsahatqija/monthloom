import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { api, app, register } from '../http.js';

describe('HTTP middleware and health', () => {
  it('reports liveness and database readiness', async () => {
    expect((await request(app).get('/health/live').expect(200)).body.status).toBe('ok');
    expect((await request(app).get('/health/ready').expect(200)).body.dependencies.database).toBe(
      'ok',
    );
  });
  it('returns a structured 404 and rejects malformed JSON', async () => {
    expect((await request(app).get('/missing').expect(404)).body.error.code).toBe('NOT_FOUND');
    const malformed = await request(app)
      .post(`${api}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('requires authentication and rejects mutations from untrusted origins', async () => {
    await request(app).get(`${api}/households`).expect(401);
    const { agent } = await register();
    await agent
      .patch(`${api}/users/me`)
      .set('Origin', 'https://untrusted.example')
      .send({ displayName: 'No' })
      .expect(403);
    await agent
      .patch(`${api}/users/me`)
      .set('Origin', 'http://localhost:3000')
      .send({ displayName: 'Yes', profileImage: 'diamond-kilim', desiredColor: 'indigo' })
      .expect(200);
  });
});

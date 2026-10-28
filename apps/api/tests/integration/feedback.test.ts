import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { api, app, register } from '../http.js';

describe('feedback HTTP API', () => {
  it('requires authentication and validates feedback before sending it', async () => {
    await request(app)
      .post(`${api}/feedback`)
      .send({ type: 'suggestion', feedback: 'A useful suggestion for the app.' })
      .expect(401);

    const { agent } = await register();
    const invalid = await agent
      .post(`${api}/feedback`)
      .send({ type: 'suggestion', feedback: 'short' })
      .expect(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    await agent
      .post(`${api}/feedback`)
      .send({ type: 'bug report', feedback: 'The dashboard did not update after saving.' })
      .expect(204);
  });
});

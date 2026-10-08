import { describe, expect, it } from 'vitest';

import { png } from '../fixtures.js';
import { api, register } from '../http.js';

describe('files HTTP + PostgreSQL + local storage', () => {
  it('uploads, downloads and deletes an image while enforcing owner access', async () => {
    const { agent } = await register();
    const outsider = await register();
    const response = await agent.post(`${api}/files`).attach('file', png, 'image.png').expect(201);
    const url = `${api}/files/${response.body.file.id}`;
    const content = await agent
      .get(`${url}/content`)
      .expect(200)
      .expect('Content-Type', /image\/png/);
    expect(content.body).toEqual(png);
    expect((await agent.get(`${api}/files`)).body.files).toHaveLength(1);
    await outsider.agent.get(url).expect(404);
    await outsider.agent.get(`${url}/content`).expect(404);
    await outsider.agent.delete(url).expect(404);
    expect((await outsider.agent.get(`${api}/files`)).body.files).toEqual([]);
    await agent.delete(url).expect(204);
    await agent.get(url).expect(404);
    await agent.get(`${url}/content`).expect(404);
  });

  it('rejects missing, oversized and disguised uploads', async () => {
    const { agent } = await register();
    await agent.post(`${api}/files`).expect(400);
    await agent.post(`${api}/files`).attach('file', Buffer.alloc(2048), 'large.png').expect(400);
    await agent
      .post(`${api}/files`)
      .attach('file', Buffer.from('not an image'), 'fake.png')
      .expect(400);
    expect((await agent.get(`${api}/files`)).body.files).toEqual([]);
  });
});

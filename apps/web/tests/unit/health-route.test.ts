import { describe, expect, it } from 'vitest';

import { GET } from '../../src/app/health/route';

describe('web health route', () => {
  it('reports health without application dependencies', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});

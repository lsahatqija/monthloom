import { describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../src/lib/api/client';

describe('API client', () => {
  it('encodes queries and sends credentials without caching', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    expect(
      await apiClient.get('households', { query: { name: 'A & B', omitted: undefined } }),
    ).toEqual({ ok: true });
    const [url, options] = fetch.mock.calls[0]!;
    expect(new URL(url).searchParams.get('name')).toBe('A & B');
    expect(new URL(url).searchParams.has('omitted')).toBe(false);
    expect(options).toMatchObject({ credentials: 'include', cache: 'no-store' });
  });
  it('preserves structured API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { email: ['Invalid email'] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    await expect(apiClient.post('auth/login', {})).rejects.toMatchObject({
      message: 'Invalid input',
      status: 400,
    });
  });
  it('accepts an empty 204 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await apiClient.delete('files/id')).toBeNull();
  });
  it('lets the browser generate multipart boundaries', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal('fetch', fetch);
    const data = new FormData();
    data.append('file', new Blob(['image']), 'image.png');
    await apiClient.postForm('files', data);
    expect(fetch.mock.calls[0]![1].body).toBe(data);
    expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty('Content-Type');
  });
  it('turns non-JSON server errors into a stable client error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })));
    await expect(apiClient.get('users/me')).rejects.toMatchObject({
      status: 502,
      message: 'The server returned an unexpected response.',
    });
  });
});

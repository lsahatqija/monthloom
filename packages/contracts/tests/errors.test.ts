import { describe, expect, it } from 'vitest';

import { apiErrorResponseSchema } from '../src/index.js';

describe('API error contract', () => {
  it('accepts stable reasons and interpolation parameters while preserving diagnostic prose', () => {
    expect(
      apiErrorResponseSchema.parse({
        error: {
          code: 'NOT_FOUND',
          reason: 'ROUTE_NOT_FOUND',
          params: { method: 'GET', path: '/missing' },
          message: 'No route matches GET /missing.',
        },
      }).error,
    ).toMatchObject({ reason: 'ROUTE_NOT_FOUND', params: { method: 'GET', path: '/missing' } });
  });

  it('rejects unstable reason strings', () => {
    expect(() =>
      apiErrorResponseSchema.parse({
        error: { code: 'NOT_FOUND', reason: 'some web translation key', message: 'Missing.' },
      }),
    ).toThrow();
  });
});

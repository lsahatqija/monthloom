import { describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../src/lib/api/errors';
import { apiErrorMessage } from '../../src/lib/api/localized-error';

describe('localized API errors', () => {
  it('maps a known reason and interpolation parameters without using API prose', () => {
    const translate = vi.fn((reason, params) => `${reason}: ${params?.path}`);
    const error = new ApiClientError(404, {
      code: 'NOT_FOUND',
      reason: 'ROUTE_NOT_FOUND',
      params: { method: 'GET', path: '/missing' },
      message: 'backend diagnostic text',
    });

    expect(apiErrorMessage(error, translate, 'fallback')).toBe('ROUTE_NOT_FOUND: /missing');
    expect(translate).toHaveBeenCalledWith('ROUTE_NOT_FOUND', {
      method: 'GET',
      path: '/missing',
    });
  });

  it('uses the localized fallback when a reason is absent or the error is unknown', () => {
    expect(
      apiErrorMessage(
        new ApiClientError(500, { code: 'INTERNAL_ERROR', message: 'diagnostic' }),
        vi.fn(),
        'Localized fallback',
      ),
    ).toBe('Localized fallback');
    expect(apiErrorMessage(new Error('network'), vi.fn(), 'Localized fallback')).toBe(
      'Localized fallback',
    );
  });
});

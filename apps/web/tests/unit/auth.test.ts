import { describe, expect, it } from 'vitest';

import { sanitizeRedirectTarget } from '../../src/lib/auth/safe-redirect';

describe('safe login redirects', () => {
  it.each([null, undefined, '', '//evil.example', 'https://evil.example', 'javascript:alert(1)'])(
    'rejects external or missing target %s',
    (target) => {
      expect(sanitizeRedirectTarget(target)).toBe('/settings');
    },
  );
  it('preserves an internal path and query string', () => {
    expect(sanitizeRedirectTarget('/dashboard?month=2026-01')).toBe('/dashboard?month=2026-01');
  });
});

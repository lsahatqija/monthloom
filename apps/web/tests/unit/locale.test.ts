import { describe, expect, it } from 'vitest';

import { resolveLocale } from '../../src/i18n/config';

describe('locale resolution', () => {
  it('prefers the authenticated user locale over the cookie', () => {
    expect(resolveLocale('tr', 'fr')).toBe('tr');
  });

  it('uses a supported cookie locale for a signed-out user', () => {
    expect(resolveLocale(undefined, 'de')).toBe('de');
  });

  it.each([undefined, '', 'es', 'en_US'])('falls back to English for cookie %j', (cookie) => {
    expect(resolveLocale(undefined, cookie)).toBe('en');
  });
});

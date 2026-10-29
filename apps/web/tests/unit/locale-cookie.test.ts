import { describe, expect, it, vi } from 'vitest';

import { setLocaleCookie } from '../../src/i18n/locale-cookie';

describe('locale cookie', () => {
  it('uses a long-lived site-wide lax cookie', () => {
    const cookieSetter = vi.spyOn(document, 'cookie', 'set');

    setLocaleCookie('fr');

    expect(cookieSetter).toHaveBeenCalledWith(
      'monthloom-locale=fr; Path=/; Max-Age=31536000; SameSite=Lax',
    );
  });
});

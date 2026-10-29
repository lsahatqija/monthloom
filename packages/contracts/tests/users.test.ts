import { describe, expect, it } from 'vitest';

import { Constants, localeSchema } from '../src/index.js';

describe('user contracts', () => {
  it.each(Constants.SUPPORTED_LOCALES)('accepts supported locale %s', (locale) => {
    expect(localeSchema.parse(locale)).toBe(locale);
  });

  it('rejects unsupported locales', () => {
    expect(localeSchema.safeParse('de').success).toBe(false);
  });
});

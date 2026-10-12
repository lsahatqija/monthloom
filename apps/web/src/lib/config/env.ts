import { z } from 'zod';

/**
 * Validated frontend configuration. Only variables intentionally meant for the browser use
 * the `NEXT_PUBLIC_` prefix; everything else stays server-only.
 */
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  API_INTERNAL_URL: z.string().url().optional(),
});

const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
});

export const webConfig = {
  /**
   * Base URL used by the browser. An empty value intentionally means the current origin, which
   * allows one production image to run behind any same-origin reverse proxy.
   */
  publicApiUrl: env.NEXT_PUBLIC_API_URL ?? '',
  /** Base URL used by server-side code (Server Components, route handlers); may differ inside Docker. */
  internalApiUrl: env.API_INTERNAL_URL ?? env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
} as const;

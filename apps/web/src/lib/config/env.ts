import { webEnvSchema } from './env.schema';

/**
 * Validated frontend configuration. Only variables intentionally meant for the browser use
 * the `NEXT_PUBLIC_` prefix; everything else stays server-only.
 */
const env = webEnvSchema.parse({
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

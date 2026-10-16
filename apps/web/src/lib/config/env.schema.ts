import { z } from 'zod';

export const webEnvShape = {
  NEXT_PUBLIC_API_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  API_INTERNAL_URL: z.string().url().optional(),
} satisfies z.ZodRawShape;

export const webEnvSchema = z.object(webEnvShape);
export const webEnvKeys = Object.keys(webEnvShape);

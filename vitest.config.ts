import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const resolve = {
  alias: {
    '@template/contracts': `${root}packages/contracts/src/index.ts`,
    '@assets': `${root}assets`,
    '@': `${root}apps/web/src`,
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve,
        test: {
          name: 'contracts-unit',
          root: `${root}packages/contracts`,
          include: ['tests/**/*.test.ts'],
        },
      },
      ...(['unit', 'integration'] as const).map((kind) => ({
        resolve,
        test: {
          name: `api-${kind}`,
          root: `${root}apps/api`,
          include: [`tests/${kind}/**/*.test.ts`],
          setupFiles: [
            `${root}apps/api/tests/setup-env.ts`,
            ...(kind === 'integration' ? [`${root}apps/api/tests/setup-integration.ts`] : []),
          ],
          sequence: { setupFiles: 'list' as const },
          testTimeout: 15_000,
          hookTimeout: 30_000,
          maxWorkers: 2,
          restoreMocks: true,
        },
      })),
      ...(['unit', 'integration'] as const).map((kind) => ({
        resolve,
        esbuild: { jsx: 'automatic' as const },
        plugins: [
          {
            name: 'next-static-image-test-imports',
            enforce: 'pre' as const,
            load(id: string) {
              // Next exposes imported images as objects; Vite normally returns URL strings.
              if (/\.(png|jpe?g|webp)$/.test(id)) {
                return `export default ${JSON.stringify({ src: id })}`;
              }
            },
          },
        ],
        test: {
          name: `web-${kind}`,
          root: `${root}apps/web`,
          environment: 'jsdom',
          include: [`tests/${kind}/**/*.test.{ts,tsx}`],
          setupFiles: [`${root}apps/web/tests/setup.ts`],
          restoreMocks: true,
          unstubGlobals: true,
        },
      })),
    ],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/contracts/src/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/server.ts',
        '**/migrate.ts',
        '**/seed.ts',
        '**/sync-resend-templates.ts',
      ],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      // Initial regression floors. Raise these as coverage grows; do not lower them for a feature.
      thresholds: {
        lines: 60,
        statements: 60,
        branches: 75,
        functions: 65,
        'apps/api/src/**': { lines: 85, statements: 85, branches: 78, functions: 78 },
        'apps/web/src/**': { lines: 30, statements: 30, branches: 70, functions: 50 },
        'packages/contracts/src/**': { lines: 95, statements: 95, branches: 95, functions: 80 },
      },
    },
  },
});

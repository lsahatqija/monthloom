import config from '@template/eslint-config';

export default [
  ...config,
  {
    files: ['src/modules/**/*.ts'],
    ignores: ['src/modules/**/adapters/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../../../*'],
              message:
                'Import too deeply nested; restructure the module instead of reaching across many directories.',
            },
            {
              group: ['./adapters/**', '../*/adapters/**', '**/modules/**/adapters/**'],
              message:
                'Application modules must depend on repository interfaces, not persistence adapters. Wire adapters in composition.ts.',
            },
          ],
        },
      ],
    },
  },
];

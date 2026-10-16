import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateOpenApiDocument } from '../../src/infrastructure/openapi/document.js';

const modules = [
  { name: 'auth', file: 'auth/auth.routes.ts', base: '/api/v1/auth' },
  { name: 'users', file: 'users/user.routes.ts', base: '/api/v1/users' },
  { name: 'files', file: 'files/file.routes.ts', base: '/api/v1/files' },
  { name: 'finance', file: 'finance/finance.routes.ts', base: '/api/v1/households' },
  { name: 'system', file: 'system/system.routes.ts', base: '/health' },
] as const;

function runtimeRoutes() {
  return modules.flatMap(({ file, base }) => {
    const source = readFileSync(path.resolve('apps/api/src/modules', file), 'utf8');
    return [...source.matchAll(/router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)].map(
      ([, method, routePath]) => {
        const fullPath = `${base}${routePath === '/' ? '' : routePath}`.replace(
          /:([A-Za-z][A-Za-z0-9_]*)/g,
          '{$1}',
        );
        return `${method!.toUpperCase()} ${fullPath}`;
      },
    );
  });
}

describe('OpenAPI document', () => {
  it('documents every application route and no stale routes', () => {
    const document = generateOpenApiDocument();
    const documented = Object.entries(document.paths).flatMap(([routePath, operations]) =>
      Object.keys(operations ?? {})
        .filter((method) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
        .map((method) => `${method.toUpperCase()} ${routePath}`),
    );

    expect(documented.sort()).toEqual(runtimeRoutes().sort());
  });

  it('keeps useful human-facing metadata', () => {
    const document = generateOpenApiDocument();
    expect(document.info.title).toBe('Monthloom API');
    for (const operations of Object.values(document.paths)) {
      for (const operation of Object.values(operations ?? {})) {
        if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue;
        expect(operation.summary).toBeTruthy();
        expect(Object.keys(operation.responses)).not.toHaveLength(0);
      }
    }
  });
});

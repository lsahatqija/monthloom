import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as contracts from '@monthloom/contracts';

export function registerAdminOpenApi(registry: OpenAPIRegistry): void {
  registerAdminPath(
    registry,
    '/api/v1/admin/overview',
    'Get administration overview metrics',
    'Current application metrics.',
    contracts.adminOverviewResponseSchema,
  );
  registry.registerPath({
    method: 'get',
    path: '/api/v1/admin/usage',
    summary: 'Get administration usage analytics',
    tags: ['Administration'],
    security: [{ sessionCookie: [] }],
    request: { query: contracts.adminAnalyticsRangeQuerySchema },
    responses: {
      200: {
        description: 'Range-aware usage, transaction, and engagement analytics.',
        content: { 'application/json': { schema: contracts.adminUsageResponseSchema } },
      },
      401: {
        description: 'Authentication required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
      403: {
        description: 'Administrator role required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
  registerAdminPath(
    registry,
    '/api/v1/admin/health',
    'Get administration application health',
    'Current application health and recent warning, error, and fatal logs.',
    contracts.adminHealthResponseSchema,
  );
  registry.registerPath({
    method: 'get',
    path: '/api/v1/admin/dashboard',
    summary: 'Get administration dashboard metrics and application health',
    tags: ['Administration'],
    security: [{ sessionCookie: [] }],
    responses: {
      200: {
        description: 'Current application metrics and recent warning, error, and fatal logs.',
        content: {
          'application/json': { schema: contracts.adminDashboardResponseSchema },
        },
      },
      401: {
        description: 'Authentication required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
      403: {
        description: 'Administrator role required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
}

function registerAdminPath(
  registry: OpenAPIRegistry,
  path: string,
  summary: string,
  description: string,
  schema: typeof contracts.adminOverviewResponseSchema | typeof contracts.adminHealthResponseSchema,
): void {
  registry.registerPath({
    method: 'get',
    path,
    summary,
    tags: ['Administration'],
    security: [{ sessionCookie: [] }],
    responses: {
      200: { description, content: { 'application/json': { schema } } },
      401: {
        description: 'Authentication required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
      403: {
        description: 'Administrator role required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
}

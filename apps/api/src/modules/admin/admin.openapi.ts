import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as contracts from '@monthloom/contracts';

export function registerAdminOpenApi(registry: OpenAPIRegistry): void {
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

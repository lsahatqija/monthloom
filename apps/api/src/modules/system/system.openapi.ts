import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as contracts from '@monthloom/contracts';

export function registerSystemOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/health/live',
    summary: 'Liveness probe',
    tags: ['System'],
    responses: {
      200: {
        description: 'The process is running.',
        content: { 'application/json': { schema: contracts.livenessResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'get',
    path: '/health/ready',
    summary: 'Readiness probe',
    tags: ['System'],
    responses: {
      200: {
        description: 'Required infrastructure is available.',
        content: { 'application/json': { schema: contracts.readinessResponseSchema } },
      },
      503: {
        description: 'Required infrastructure is unavailable.',
        content: { 'application/json': { schema: contracts.readinessResponseSchema } },
      },
    },
  });
}


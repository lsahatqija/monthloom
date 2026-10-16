import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as contracts from '@monthloom/contracts';
import { z } from 'zod';

export function registerUsersOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/users/me',
    summary: 'Update the authenticated user profile',
    tags: ['Users'],
    security: [{ sessionCookie: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: contracts.updateProfileRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Updated user profile.',
        content: {
          'application/json': { schema: z.object({ user: contracts.publicUserSchema }) },
        },
      },
      401: {
        description: 'Authentication required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/v1/users/me/password',
    summary: "Change the authenticated user's password",
    tags: ['Users'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      body: { content: { 'application/json': { schema: contracts.changePasswordRequestSchema } } },
    },
    responses: {
      204: { description: 'Password changed.' },
      400: {
        description: 'Invalid current or new password.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
      401: {
        description: 'Authentication required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/me',
    summary: 'Get the authenticated user profile',
    tags: ['Users'],
    security: [{ ['sessionCookie']: [] }],
    responses: {
      200: {
        description: 'Current user profile.',
        content: { 'application/json': { schema: z.object({ user: contracts.publicUserSchema }) } },
      },
      401: {
        description: 'Authentication required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
}


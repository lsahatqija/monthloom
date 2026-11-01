import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as contracts from '@monthloom/contracts';
import { z } from 'zod';

export function registerFinanceOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/api/v1/households/invitations/{token}',
    summary: 'Read a valid household invitation',
    tags: ['Households'],
    request: { params: z.object({ token: z.string().min(1) }) },
    responses: {
      200: {
        description: 'Invitation details.',
        content: { 'application/json': { schema: contracts.householdInvitationSchema } },
      },
      404: {
        description: 'Invitation is invalid, expired, or used.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/households/invitations/{token}/accept',
    summary: 'Accept a household invitation',
    tags: ['Households'],
    security: [{ sessionCookie: [] }],
    request: { params: z.object({ token: z.string().min(1) }) },
    responses: {
      200: {
        description: 'Invitation accepted.',
        content: {
          'application/json': { schema: contracts.acceptHouseholdInvitationResponseSchema },
        },
      },
      404: {
        description: 'Invitation is invalid, expired, or used.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/households/{id}/invitations',
    summary: 'Create link or email household invitations',
    tags: ['Households'],
    security: [{ sessionCookie: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          'application/json': { schema: contracts.createHouseholdInvitationRequestSchema },
        },
      },
    },
    responses: {
      201: {
        description: 'Invitation created or delivery attempted.',
        content: {
          'application/json': { schema: contracts.createHouseholdInvitationResponseSchema },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/households',
    summary: "List the current user's households",
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    responses: {
      200: {
        description: 'Households and their members.',
        content: { 'application/json': { schema: contracts.householdListResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/households',
    summary: 'Create a household',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      body: { content: { 'application/json': { schema: contracts.createHouseholdRequestSchema } } },
    },
    responses: {
      201: {
        description: 'Household created.',
        content: { 'application/json': { schema: contracts.householdResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/v1/households/{id}/primary',
    summary: 'Make a household active for the current user',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: 'Active household changed.' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/households/{id}/leave',
    summary: 'Leave a household, optionally transferring ownership',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: contracts.transferHouseholdOwnershipRequestSchema.partial(),
          },
        },
      },
    },
    responses: { 204: { description: 'Household left.' } },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/households/{id}/members/{memberId}',
    summary: 'Remove a household member as the owner',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid(), memberId: z.string().uuid() }),
    },
    responses: { 204: { description: 'Member removed.' } },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/households/{id}',
    summary: 'Delete a household as the owner',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: 'Household deleted.' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/households/primary/month',
    summary: 'Get the default household dashboard for a month',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: { query: contracts.householdMonthQuerySchema },
    responses: {
      200: {
        description: 'Primary household monthly summary and transactions.',
        content: { 'application/json': { schema: contracts.householdMonthResponseSchema } },
      },
      401: {
        description: 'Authentication required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/households/{id}/month',
    summary: 'Get a household dashboard for a month',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      query: contracts.householdMonthQuerySchema,
    },
    responses: {
      200: {
        description: 'Household monthly summary and transactions.',
        content: { 'application/json': { schema: contracts.householdMonthResponseSchema } },
      },
      403: {
        description: 'Not a household member.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/households/{id}/transactions',
    summary: 'Create a household transaction',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          'application/json': { schema: contracts.createHouseholdTransactionRequestSchema },
        },
      },
    },
    responses: {
      201: {
        description: 'Transaction created.',
        content: { 'application/json': { schema: contracts.householdTransactionResponseSchema } },
      },
      403: {
        description: 'Not a household member.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/households/{id}/transactions',
    summary: 'Get household transactions for an inclusive month range',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      query: contracts.householdTransactionRangeQuerySchema,
    },
    responses: {
      200: {
        description: 'Household details and raw realized and projected transactions.',
        content: {
          'application/json': { schema: contracts.householdTransactionRangeResponseSchema },
        },
      },
      400: {
        description: 'Invalid or unsupported month range.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
      403: {
        description: 'Not a household member.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/households/{id}/sources',
    summary: 'Create a source for a household',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: contracts.createHouseholdSourceRequestSchema } },
      },
    },
    responses: {
      201: {
        description: 'Source created.',
        content: { 'application/json': { schema: contracts.householdSourceResponseSchema } },
      },
      403: {
        description: 'Not a household member.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/households/{id}/sources',
    summary: 'List the sources in a household',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: 'Household sources.',
        content: { 'application/json': { schema: contracts.householdSourceListResponseSchema } },
      },
      403: {
        description: 'Not a household member.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/households/{id}/sources/{sourceId}',
    summary: 'Update a household source',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid(), sourceId: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: contracts.updateHouseholdSourceRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Source updated.',
        content: { 'application/json': { schema: contracts.householdSourceResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/households/{id}/sources/{sourceId}',
    summary: 'Delete an unused household source',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: { params: z.object({ id: z.string().uuid(), sourceId: z.string().uuid() }) },
    responses: { 204: { description: 'Source deleted.' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/households/{id}/sources/copy',
    summary: 'Copy selected sources between two households',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: contracts.copyHouseholdSourcesRequestSchema } },
      },
    },
    responses: {
      201: {
        description: 'Sources copied. Existing destination keys are skipped.',
        content: { 'application/json': { schema: contracts.copyHouseholdSourcesResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/households/{id}/transactions/{transactionId}',
    summary: 'Update a household transaction',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid(), transactionId: z.string().uuid() }),
      body: {
        content: {
          'application/json': { schema: contracts.updateHouseholdTransactionRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Transaction updated.',
        content: { 'application/json': { schema: contracts.householdTransactionResponseSchema } },
      },
      403: {
        description: 'Not a household member.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
      404: {
        description: 'Transaction not found.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/households/{id}/transactions/{transactionId}',
    summary: 'Remove a household transaction',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid(), transactionId: z.string().uuid() }),
      query: contracts.removeHouseholdTransactionQuerySchema,
    },
    responses: {
      204: { description: 'Transaction removed.' },
      403: {
        description: 'Not a household member.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
      404: {
        description: 'Transaction not found.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/households/{id}',
    summary: 'Update a household',
    tags: ['Households'],
    security: [{ ['sessionCookie']: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: contracts.updateHouseholdRequestSchema } } },
    },
    responses: {
      200: {
        description: 'Household updated.',
        content: { 'application/json': { schema: contracts.householdResponseSchema } },
      },
      403: {
        description: 'Not a household member.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
}

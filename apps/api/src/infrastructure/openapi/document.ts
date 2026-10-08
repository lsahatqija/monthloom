import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import {
  apiErrorResponseSchema,
  authResponseSchema,
  changePasswordRequestSchema,
  copyHouseholdSourcesRequestSchema,
  copyHouseholdSourcesResponseSchema,
  createHouseholdSourceRequestSchema,
  createHouseholdRequestSchema,
  createHouseholdTransactionRequestSchema,
  fileListResponseSchema,
  fileMetadataSchema,
  householdMonthQuerySchema,
  householdMonthResponseSchema,
  householdListResponseSchema,
  householdResponseSchema,
  householdSourceResponseSchema,
  householdSourceListResponseSchema,
  householdTransactionResponseSchema,
  livenessResponseSchema,
  loginRequestSchema,
  meResponseSchema,
  publicUserSchema,
  readinessResponseSchema,
  removeHouseholdTransactionQuerySchema,
  registerRequestSchema,
  transferHouseholdOwnershipRequestSchema,
  updateHouseholdRequestSchema,
  updateHouseholdSourceRequestSchema,
  updateHouseholdTransactionRequestSchema,
} from '@template/contracts';
import { z } from 'zod';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const bearerCookieSecurity = registry.registerComponent('securitySchemes', 'sessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'template_session',
});

const ErrorResponse = registry.register('ApiErrorResponse', apiErrorResponseSchema);
const PublicUser = registry.register('PublicUser', publicUserSchema);
const AuthResponse = registry.register('AuthResponse', authResponseSchema);
const MeResponse = registry.register('MeResponse', meResponseSchema);
const FileMetadata = registry.register('FileMetadata', fileMetadataSchema);
const FileListResponse = registry.register('FileListResponse', fileListResponseSchema);

registry.registerPath({
  method: 'get',
  path: '/api/v1/households',
  summary: "List the current user's households",
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  responses: {
    200: {
      description: 'Households and their members.',
      content: { 'application/json': { schema: householdListResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/users/me/password',
  summary: "Change the authenticated user's password",
  tags: ['Users'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    body: { content: { 'application/json': { schema: changePasswordRequestSchema } } },
  },
  responses: {
    204: { description: 'Password changed.' },
    400: {
      description: 'Invalid current or new password.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    401: {
      description: 'Authentication required.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/households',
  summary: 'Create a household',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    body: { content: { 'application/json': { schema: createHouseholdRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Household created.',
      content: { 'application/json': { schema: householdResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/health/live',
  summary: 'Liveness probe',
  tags: ['System'],
  responses: {
    200: {
      description: 'The process is running.',
      content: { 'application/json': { schema: livenessResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/households/{id}/primary',
  summary: 'Make a household active for the current user',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: 'Active household changed.' } },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/households/{id}/leave',
  summary: 'Leave a household, optionally transferring ownership',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': { schema: transferHouseholdOwnershipRequestSchema.partial() },
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
  security: [{ [bearerCookieSecurity.name]: [] }],
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
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: 'Household deleted.' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/households/primary/month',
  summary: 'Get the default household dashboard for a month',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: { query: householdMonthQuerySchema },
  responses: {
    200: {
      description: 'Primary household monthly summary and transactions.',
      content: { 'application/json': { schema: householdMonthResponseSchema } },
    },
    401: {
      description: 'Authentication required.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/households/{id}/month',
  summary: 'Get a household dashboard for a month',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: householdMonthQuerySchema,
  },
  responses: {
    200: {
      description: 'Household monthly summary and transactions.',
      content: { 'application/json': { schema: householdMonthResponseSchema } },
    },
    403: {
      description: 'Not a household member.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/households/{id}/transactions',
  summary: 'Create a household transaction',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: createHouseholdTransactionRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Transaction created.',
      content: { 'application/json': { schema: householdTransactionResponseSchema } },
    },
    403: {
      description: 'Not a household member.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/households/{id}/sources',
  summary: 'Create a source for a household',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: createHouseholdSourceRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Source created.',
      content: { 'application/json': { schema: householdSourceResponseSchema } },
    },
    403: {
      description: 'Not a household member.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/households/{id}/sources',
  summary: 'List the sources in a household',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Household sources.',
      content: { 'application/json': { schema: householdSourceListResponseSchema } },
    },
    403: {
      description: 'Not a household member.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/households/{id}/sources/{sourceId}',
  summary: 'Update a household source',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    params: z.object({ id: z.string().uuid(), sourceId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: updateHouseholdSourceRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Source updated.',
      content: { 'application/json': { schema: householdSourceResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/households/{id}/sources/{sourceId}',
  summary: 'Delete an unused household source',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: { params: z.object({ id: z.string().uuid(), sourceId: z.string().uuid() }) },
  responses: { 204: { description: 'Source deleted.' } },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/households/{id}/sources/copy',
  summary: 'Copy selected sources between two households',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: copyHouseholdSourcesRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Sources copied. Existing destination keys are skipped.',
      content: { 'application/json': { schema: copyHouseholdSourcesResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/households/{id}/transactions/{transactionId}',
  summary: 'Update a household transaction',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    params: z.object({ id: z.string().uuid(), transactionId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: updateHouseholdTransactionRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Transaction updated.',
      content: { 'application/json': { schema: householdTransactionResponseSchema } },
    },
    403: {
      description: 'Not a household member.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Transaction not found.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/households/{id}/transactions/{transactionId}',
  summary: 'Remove a household transaction',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    params: z.object({ id: z.string().uuid(), transactionId: z.string().uuid() }),
    query: removeHouseholdTransactionQuerySchema,
  },
  responses: {
    204: { description: 'Transaction removed.' },
    403: {
      description: 'Not a household member.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Transaction not found.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/households/{id}',
  summary: 'Update a household',
  tags: ['Households'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: updateHouseholdRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Household updated.',
      content: { 'application/json': { schema: householdResponseSchema } },
    },
    403: {
      description: 'Not a household member.',
      content: { 'application/json': { schema: ErrorResponse } },
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
      content: { 'application/json': { schema: readinessResponseSchema } },
    },
    503: {
      description: 'Required infrastructure is unavailable.',
      content: { 'application/json': { schema: readinessResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  summary: 'Register a new account',
  tags: ['Auth'],
  request: { body: { content: { 'application/json': { schema: registerRequestSchema } } } },
  responses: {
    201: {
      description: 'Account created.',
      content: { 'application/json': { schema: AuthResponse } },
    },
    409: {
      description: 'Email already registered.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Log in',
  tags: ['Auth'],
  request: { body: { content: { 'application/json': { schema: loginRequestSchema } } } },
  responses: {
    200: {
      description: 'Authenticated.',
      content: { 'application/json': { schema: AuthResponse } },
    },
    401: {
      description: 'Invalid credentials.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  summary: 'Log out',
  tags: ['Auth'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  responses: { 204: { description: 'Logged out.' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  summary: 'Get the current session user, if any',
  tags: ['Auth'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  responses: {
    200: {
      description: 'Current user or null.',
      content: { 'application/json': { schema: MeResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/users/me',
  summary: 'Get the authenticated user profile',
  tags: ['Users'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  responses: {
    200: {
      description: 'Current user profile.',
      content: { 'application/json': { schema: z.object({ user: PublicUser }) } },
    },
    401: {
      description: 'Authentication required.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/files',
  summary: 'Upload a file',
  tags: ['Files'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.string().openapi({ type: 'string', format: 'binary' }) }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'File uploaded.',
      content: { 'application/json': { schema: z.object({ file: FileMetadata }) } },
    },
    400: {
      description: 'Invalid file.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/files',
  summary: 'List the authenticated user files',
  tags: ['Files'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  responses: {
    200: {
      description: 'Owned files.',
      content: { 'application/json': { schema: FileListResponse } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/files/{id}/content',
  summary: 'Download file content',
  tags: ['Files'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'File content.' },
    404: {
      description: 'File not found.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/files/{id}',
  summary: 'Delete a file',
  tags: ['Files'],
  security: [{ [bearerCookieSecurity.name]: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: 'File deleted.' } },
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Fullstack TS Template API',
      version: '0.1.0',
      description: 'API documentation for the reusable fullstack template.',
    },
    servers: [{ url: '/' }],
  });
}

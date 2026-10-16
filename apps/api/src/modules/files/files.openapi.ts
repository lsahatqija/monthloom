import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as contracts from '@monthloom/contracts';
import { z } from 'zod';

export function registerFilesOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/api/v1/files/{id}',
    summary: 'Get owned file metadata',
    tags: ['Files'],
    security: [{ sessionCookie: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: 'File metadata.',
        content: {
          'application/json': { schema: z.object({ file: contracts.fileMetadataSchema }) },
        },
      },
      404: {
        description: 'File not found.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/files',
    summary: 'Upload a file',
    tags: ['Files'],
    security: [{ ['sessionCookie']: [] }],
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
        content: { 'application/json': { schema: z.object({ file: contracts.fileMetadataSchema }) } },
      },
      400: {
        description: 'Invalid file.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'get',
    path: '/api/v1/files',
    summary: 'List the authenticated user files',
    tags: ['Files'],
    security: [{ ['sessionCookie']: [] }],
    responses: {
      200: {
        description: 'Owned files.',
        content: { 'application/json': { schema: contracts.fileListResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'get',
    path: '/api/v1/files/{id}/content',
    summary: 'Download file content',
    tags: ['Files'],
    security: [{ ['sessionCookie']: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: 'File content.' },
      404: {
        description: 'File not found.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/files/{id}',
    summary: 'Delete a file',
    tags: ['Files'],
    security: [{ ['sessionCookie']: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: 'File deleted.' } },
  });
}


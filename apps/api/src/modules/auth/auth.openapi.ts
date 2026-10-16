import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as contracts from '@monthloom/contracts';

export function registerAuthOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/register',
    summary: 'Register a new account',
    tags: ['Auth'],
    request: { body: { content: { 'application/json': { schema: contracts.registerRequestSchema } } } },
    responses: {
      201: {
        description: 'Account created.',
        content: { 'application/json': { schema: contracts.authResponseSchema } },
      },
      409: {
        description: 'Email already registered.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    summary: 'Log in',
    tags: ['Auth'],
    request: { body: { content: { 'application/json': { schema: contracts.loginRequestSchema } } } },
    responses: {
      200: {
        description: 'Authenticated.',
        content: { 'application/json': { schema: contracts.authResponseSchema } },
      },
      401: {
        description: 'Invalid credentials.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/forgot-password',
    summary: 'Request a password reset email',
    description: 'Always returns the same response so registered email addresses are not disclosed.',
    tags: ['Auth'],
    request: {
      body: { content: { 'application/json': { schema: contracts.forgotPasswordRequestSchema } } },
    },
    responses: {
      202: {
        description: 'The reset request was accepted.',
        content: { 'application/json': { schema: contracts.forgotPasswordResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/reset-password',
    summary: 'Set a new password using a single-use reset token',
    tags: ['Auth'],
    request: {
      body: { content: { 'application/json': { schema: contracts.resetPasswordRequestSchema } } },
    },
    responses: {
      204: { description: 'Password reset and existing sessions revoked.' },
      400: {
        description: 'The token is invalid or expired, or the password is invalid.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/verify-email',
    summary: 'Verify an email address using a single-use token',
    tags: ['Auth'],
    request: {
      body: { content: { 'application/json': { schema: contracts.verifyEmailRequestSchema } } },
    },
    responses: {
      200: {
        description: 'Email address verified.',
        content: { 'application/json': { schema: contracts.emailVerificationResponseSchema } },
      },
      400: {
        description: 'The token is invalid or expired.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/send-email-verification',
    summary: 'Send a new email-verification link',
    tags: ['Auth'],
    security: [{ ['sessionCookie']: [] }],
    responses: {
      202: {
        description: 'Verification email request accepted.',
        content: { 'application/json': { schema: contracts.emailVerificationResponseSchema } },
      },
      401: {
        description: 'Authentication required.',
        content: { 'application/json': { schema: contracts.apiErrorResponseSchema } },
      },
    },
  });
  
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/logout',
    summary: 'Log out',
    tags: ['Auth'],
    security: [{ ['sessionCookie']: [] }],
    responses: { 204: { description: 'Logged out.' } },
  });
  
  registry.registerPath({
    method: 'get',
    path: '/api/v1/auth/me',
    summary: 'Get the current session user, if any',
    tags: ['Auth'],
    security: [{ ['sessionCookie']: [] }],
    responses: {
      200: {
        description: 'Current user or null.',
        content: { 'application/json': { schema: contracts.meResponseSchema } },
      },
    },
  });
}


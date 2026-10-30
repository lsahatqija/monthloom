import type { ApiErrorCode, ApiErrorParams, ApiErrorReason } from '@monthloom/contracts';

/** Base class for all typed application errors, carrying an HTTP-mappable error code. */
export abstract class AppError extends Error {
  abstract readonly code: ApiErrorCode;
  abstract readonly statusCode: number;
  readonly reason: ApiErrorReason;
  readonly params?: ApiErrorParams;
  readonly details?: Record<string, string[]>;

  constructor(
    message: string,
    reason: ApiErrorReason,
    details?: Record<string, string[]>,
    params?: ApiErrorParams,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.reason = reason;
    this.params = params;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly statusCode = 400;

  constructor(
    message = 'The submitted data is invalid.',
    details?: Record<string, string[]>,
    reason: ApiErrorReason = 'INVALID_INPUT',
    params?: ApiErrorParams,
  ) {
    super(message, reason, details, params);
  }
}

export class AuthenticationError extends AppError {
  readonly code = 'AUTHENTICATION_ERROR' as const;
  readonly statusCode = 401;

  constructor(message = 'Invalid credentials.', reason: ApiErrorReason = 'INVALID_CREDENTIALS') {
    super(message, reason);
  }
}

export class AuthorizationError extends AppError {
  readonly code = 'AUTHORIZATION_ERROR' as const;
  readonly statusCode = 403;

  constructor(
    message = 'You are not allowed to perform this action.',
    reason: ApiErrorReason = 'NOT_AUTHORIZED',
  ) {
    super(message, reason);
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND' as const;
  readonly statusCode = 404;

  constructor(
    message = 'The requested resource was not found.',
    reason: ApiErrorReason = 'RESOURCE_NOT_FOUND',
  ) {
    super(message, reason);
  }
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT' as const;
  readonly statusCode = 409;

  constructor(
    message = 'The request conflicts with existing data.',
    reason: ApiErrorReason = 'CONFLICT',
  ) {
    super(message, reason);
  }
}

export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMITED' as const;
  readonly statusCode = 429;

  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 'RATE_LIMITED');
  }
}

export class InternalError extends AppError {
  readonly code = 'INTERNAL_ERROR' as const;
  readonly statusCode = 500;

  constructor(message = 'An unexpected error occurred.') {
    super(message, 'INTERNAL_ERROR');
  }
}

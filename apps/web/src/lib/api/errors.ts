import type { ApiErrorBody } from '@monthloom/contracts';

/** Thrown by the API client whenever the backend returns the standard error shape. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorBody['code'];
  readonly reason?: ApiErrorBody['reason'];
  readonly params?: ApiErrorBody['params'];
  readonly details?: ApiErrorBody['details'];
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.code;
    this.reason = body.reason;
    this.params = body.params;
    this.details = body.details;
    this.requestId = body.requestId;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

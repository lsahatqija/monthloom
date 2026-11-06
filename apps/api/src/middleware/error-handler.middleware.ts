import type { ApiErrorCode } from '@monthloom/contracts';
import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

import { logger } from '../infrastructure/logging/logger.js';
import { AppError } from '../shared/errors/index.js';

function zodErrorToDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    details[key] = [...(details[key] ?? []), issue.message];
  }
  return details;
}

/**
 * Final, central error handler. Maps typed application errors, known third-party error
 * shapes and unexpected errors to the standard `{ error }` response shape. Never leaks
 * stack traces or internal details to the client.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.id;

  if (err instanceof AppError) {
    res.locals.logErrorCode = err.code;
    res.locals.logErrorReason = err.reason;

    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, 'Request failed with an internal error');
    }

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        reason: err.reason,
        params: err.params,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.locals.logErrorCode = 'VALIDATION_ERROR';
    res.locals.logErrorReason = 'INVALID_INPUT';
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR' satisfies ApiErrorCode,
        reason: 'INVALID_INPUT',
        message: 'The submitted data is invalid.',
        details: zodErrorToDetails(err),
        requestId,
      },
    });
    return;
  }

  if (err instanceof MulterError) {
    const code: ApiErrorCode = 'VALIDATION_ERROR';
    const reason = mapMulterReason(err);
    res.locals.logErrorCode = code;
    res.locals.logErrorReason = reason;
    res.status(400).json({
      error: { code, reason, message: mapMulterMessage(err), requestId },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.locals.logErrorCode = 'VALIDATION_ERROR';
    res.locals.logErrorReason = 'INVALID_JSON';
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR' satisfies ApiErrorCode,
        reason: 'INVALID_JSON',
        message: 'The request body is not valid JSON.',
        requestId,
      },
    });
    return;
  }

  if (isPayloadTooLargeError(err)) {
    res.locals.logErrorCode = 'VALIDATION_ERROR';
    res.locals.logErrorReason = 'PAYLOAD_TOO_LARGE';
    res.status(413).json({
      error: {
        code: 'VALIDATION_ERROR' satisfies ApiErrorCode,
        reason: 'PAYLOAD_TOO_LARGE',
        message: 'The request payload is too large.',
        requestId,
      },
    });
    return;
  }

  res.locals.logErrorCode = 'INTERNAL_ERROR';
  res.locals.logErrorReason = 'INTERNAL_ERROR';
  logger.error({ err, requestId }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR' satisfies ApiErrorCode,
      reason: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    },
  });
};

function mapMulterMessage(err: MulterError): string {
  if (err.code === 'LIMIT_FILE_SIZE') return 'The uploaded file exceeds the maximum allowed size.';
  if (err.code === 'LIMIT_UNEXPECTED_FILE') return 'Unexpected file field in the upload.';
  return 'The uploaded multipart data could not be processed.';
}

function mapMulterReason(err: MulterError) {
  if (err.code === 'LIMIT_FILE_SIZE') return 'UPLOAD_TOO_LARGE' as const;
  if (err.code === 'LIMIT_UNEXPECTED_FILE') return 'UPLOAD_FIELD_INVALID' as const;
  return 'UPLOAD_INVALID' as const;
}

function isPayloadTooLargeError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.too.large'
  );
}

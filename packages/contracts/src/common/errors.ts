import { z } from 'zod';

/**
 * Standard error codes returned by the API. Kept intentionally small and stable
 * since frontend code may switch on these values.
 */
export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorReasonSchema = z.enum([
  'INVALID_INPUT',
  'INVALID_CREDENTIALS',
  'AUTHENTICATION_REQUIRED',
  'NOT_AUTHORIZED',
  'ORIGIN_NOT_ALLOWED',
  'RESOURCE_NOT_FOUND',
  'USER_NOT_FOUND',
  'EMAIL_ALREADY_REGISTERED',
  'CURRENT_PASSWORD_INCORRECT',
  'PASSWORD_RESET_TOKEN_INVALID',
  'EMAIL_VERIFICATION_TOKEN_INVALID',
  'FILE_REQUIRED',
  'FILE_TYPE_UNSUPPORTED',
  'FILE_CONTENT_INVALID',
  'HOUSEHOLD_NOT_FOUND',
  'HOUSEHOLD_ACCESS_DENIED',
  'HOUSEHOLD_CONFLICT',
  'INVITATION_INVALID',
  'INVITATION_EXPIRED',
  'ALREADY_HOUSEHOLD_MEMBER',
  'SOURCE_NOT_FOUND',
  'SOURCE_NAME_CONFLICT',
  'SOURCE_IN_USE',
  'TRANSACTION_NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INVALID_JSON',
  'PAYLOAD_TOO_LARGE',
  'UPLOAD_TOO_LARGE',
  'UPLOAD_FIELD_INVALID',
  'UPLOAD_INVALID',
  'ROUTE_NOT_FOUND',
  'INTERNAL_ERROR',
]);

export type ApiErrorReason = z.infer<typeof apiErrorReasonSchema>;
export const apiErrorParamsSchema = z.record(z.union([z.string(), z.number()]));
export type ApiErrorParams = z.infer<typeof apiErrorParamsSchema>;

export const apiErrorDetailsSchema = z.record(z.array(z.string())).optional();

export const apiErrorBodySchema = z.object({
  code: apiErrorCodeSchema,
  reason: apiErrorReasonSchema.optional(),
  params: apiErrorParamsSchema.optional(),
  message: z.string(),
  details: apiErrorDetailsSchema,
  requestId: z.string().optional(),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/** Full shape returned by the API for every non-2xx JSON response. */
export const apiErrorResponseSchema = z.object({
  error: apiErrorBodySchema,
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

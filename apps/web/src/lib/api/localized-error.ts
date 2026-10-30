import type { ApiErrorParams, ApiErrorReason } from '@monthloom/contracts';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { isApiClientError } from './errors';

type ErrorTranslator = (reason: ApiErrorReason, params?: ApiErrorParams) => string;

export function apiErrorMessage(
  error: unknown,
  translate: ErrorTranslator,
  fallback: string,
): string {
  return isApiClientError(error) && error.reason ? translate(error.reason, error.params) : fallback;
}

export function useApiErrorMessage() {
  const t = useTranslations('ApiErrors');
  return useCallback(
    (error: unknown, fallback = t('UNKNOWN')) => apiErrorMessage(error, t, fallback),
    [t],
  );
}

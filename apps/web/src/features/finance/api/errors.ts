import { isApiClientError } from '../../../lib/api/errors';

export function financeErrorMessage(error: unknown, fallback: string): string {
  return isApiClientError(error) ? error.message : fallback;
}

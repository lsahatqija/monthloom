import type { SendFeedbackRequest } from '@monthloom/contracts';

import { apiClient } from '../../lib/api/client';

export async function sendFeedback(input: SendFeedbackRequest): Promise<void> {
  await apiClient.post('feedback', input);
}

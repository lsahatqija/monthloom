import { z } from 'zod';

export const feedbackTypes = [
  'suggestion',
  'bug report',
  'feature request',
  'complaint',
  'other',
] as const;

export const feedbackTypeSchema = z.enum(feedbackTypes);

export const sendFeedbackRequestSchema = z.object({
  type: feedbackTypeSchema,
  anonymous: z.boolean().default(false),
  feedback: z
    .string()
    .trim()
    .min(10, 'Please describe your feedback in at least 10 characters')
    .max(5000, 'Feedback must be 5,000 characters or fewer'),
});

export type FeedbackType = z.infer<typeof feedbackTypeSchema>;
export type SendFeedbackRequest = z.infer<typeof sendFeedbackRequestSchema>;

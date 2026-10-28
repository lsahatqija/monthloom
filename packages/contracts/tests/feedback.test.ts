import { describe, expect, it } from 'vitest';

import { sendFeedbackRequestSchema } from '../src/index.js';

describe('feedback contracts', () => {
  it('trims and accepts supported feedback', () => {
    expect(
      sendFeedbackRequestSchema.parse({
        type: 'suggestion',
        feedback: '  A detailed suggestion for Monthloom.  ',
      }),
    ).toEqual({ type: 'suggestion', feedback: 'A detailed suggestion for Monthloom.' });
  });

  it.each([
    { type: 'praise', feedback: 'A detailed message about Monthloom.' },
    { type: 'bug report', feedback: 'Too short' },
    { type: 'complaint', feedback: 'x'.repeat(5001) },
  ])('rejects invalid feedback %j', (input) => {
    expect(sendFeedbackRequestSchema.safeParse(input).success).toBe(false);
  });
});

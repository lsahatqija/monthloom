import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedbackModal } from '../../src/features/feedback/feedback-modal';
import { renderWithQuery } from '../render';

describe('feedback modal', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      }),
    });
  });

  it('validates and submits feedback through the authenticated API', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    renderWithQuery(<FeedbackModal />);

    await userEvent.click(screen.getByRole('button', { name: 'Feedback' }));
    await userEvent.clear(screen.getByLabelText('Your feedback'));
    await userEvent.type(screen.getByLabelText('Your feedback'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));

    expect(await screen.findByText(/at least 10 characters/i)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Your feedback'));
    await userEvent.type(
      screen.getByLabelText('Your feedback'),
      'The monthly dashboard needs a yearly overview.',
    );
    await userEvent.selectOptions(screen.getByLabelText('Feedback type'), 'feature request');
    await userEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          type: 'feature request',
          feedback: 'The monthly dashboard needs a yearly overview.',
        }),
      }),
    );
    expect(await screen.findByText(/feedback has been sent/i)).toBeVisible();
  });
});

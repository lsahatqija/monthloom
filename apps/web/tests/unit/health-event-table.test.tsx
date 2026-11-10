import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { HealthEventTable } from '../../src/app/(authenticated)/admin/health-event-table';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

describe('health event table', () => {
  it('opens the full logged error from an event row', async () => {
    const user = userEvent.setup();
    render(
      <HealthEventTable
        locale="en"
        labels={{
          event: 'Event',
          source: 'Source',
          time: 'Time',
          details: 'Error details',
          close: 'Close',
        }}
        entries={[
          {
            timestamp: '2026-11-10T10:00:00.000Z',
            level: 'error',
            category: 'http',
            message: 'Request failed',
            detail: 'GET /api/v1/admin/retention · 500',
            fullMessage: 'PostgresError: syntax error at or near offset\n  at getRetention',
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Request failed/i }));

    expect(screen.getByRole('heading', { name: 'Error details' })).toBeVisible();
    expect(screen.getByText(/PostgresError: syntax error/)).toBeVisible();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
  });
});

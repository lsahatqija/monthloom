import type { PublicUser } from '@monthloom/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileForm } from '../../src/features/users/profile-form';
import { renderWithQuery } from '../render';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const user: PublicUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'person@example.com',
  emailVerified: true,
  displayName: 'Person',
  profileImage: 'diamond-kilim',
  desiredColor: 'indigo',
  locale: 'en',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('profile locale preference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = 'monthloom-locale=; Path=/; Max-Age=0';
  });

  it('persists the selected locale, remembers it, and refreshes Server Components', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ user: { ...user, locale: 'fr' } }));
    vi.stubGlobal('fetch', fetch);
    renderWithQuery(<ProfileForm user={user} />);

    expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('option', { name: 'Shqip' })).toHaveAttribute('lang', 'sq');
    expect(screen.getByRole('option', { name: 'Français' })).toHaveAttribute('lang', 'fr');
    expect(screen.getByRole('option', { name: 'Türkçe' })).toHaveAttribute('lang', 'tr');

    await userEvent.selectOptions(screen.getByLabelText('Language'), 'fr');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/users/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          displayName: 'Person',
          profileImage: 'diamond-kilim',
          desiredColor: 'indigo',
          locale: 'fr',
        }),
      }),
    );
    expect(document.cookie).toContain('monthloom-locale=fr');
  });
});

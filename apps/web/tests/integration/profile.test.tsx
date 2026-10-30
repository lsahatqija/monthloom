import type { PublicUser } from '@monthloom/contracts';
import { screen, waitFor, within } from '@testing-library/react';
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

    const languagePicker = screen.getByRole('group', { name: 'Language' });
    const languageTrigger = languagePicker.querySelector('summary');
    expect(languageTrigger).toHaveTextContent('English');
    expect(languageTrigger?.querySelector('img')).toHaveAttribute('src', '/flags/gb.svg');
    await userEvent.click(languageTrigger!);

    const english = within(languagePicker).getByRole('radio', { name: 'English' });
    expect(english.closest('label')).toHaveAttribute('lang', 'en');
    expect(english.closest('label')?.querySelector('img')).toHaveAttribute('src', '/flags/gb.svg');
    expect(
      within(languagePicker).getByRole('radio', { name: 'Shqip' }).closest('label'),
    ).toHaveAttribute('lang', 'sq');
    expect(
      within(languagePicker).getByRole('radio', { name: 'Français' }).closest('label'),
    ).toHaveAttribute('lang', 'fr');
    expect(
      within(languagePicker).getByRole('radio', { name: 'Türkçe' }).closest('label'),
    ).toHaveAttribute('lang', 'tr');
    expect(
      within(languagePicker).getByRole('radio', { name: 'Deutsch' }).closest('label'),
    ).toHaveAttribute('lang', 'de');

    await userEvent.click(within(languagePicker).getByRole('radio', { name: 'Français' }));
    expect(languageTrigger?.parentElement).not.toHaveAttribute('open');
    expect(languageTrigger).toHaveTextContent('Français');
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

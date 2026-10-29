import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '../../src/features/auth/login-form';
import { LogoutButton } from '../../src/features/auth/logout-button';
import { renderWithQuery } from '../render';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('login form + validation + query + HTTP client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = 'monthloom-locale=; Path=/; Max-Age=0';
  });

  it('shows validation errors without making a request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderWithQuery(<LoginForm redirectTo="/dashboard" />);
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Invalid email address')).toBeVisible();
    expect(screen.getByText('Password is required')).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('submits credentials and refreshes auth state before navigating', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ user: { id: 'user', locale: 'tr' } }));
    vi.stubGlobal('fetch', fetch);
    const { client } = renderWithQuery(<LoginForm redirectTo="/dashboard" />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await userEvent.type(screen.getByLabelText('Email'), 'person@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/dashboard'));
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'person@example.com', password: 'password123' }),
        credentials: 'include',
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['auth', 'me'] });
    expect(document.cookie).toContain('monthloom-locale=tr');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('shows a server error and keeps the user on the form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: 'AUTHENTICATION_ERROR',
              reason: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password.',
            },
          },
          { status: 401 },
        ),
      ),
    );
    renderWithQuery(<LoginForm redirectTo="/dashboard" />);
    await userEvent.type(screen.getByLabelText('Email'), 'person@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('keeps the remembered locale after logout', async () => {
    document.cookie = 'monthloom-locale=fr; Path=/';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    renderWithQuery(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'));
    expect(document.cookie).toContain('monthloom-locale=fr');
  });
});

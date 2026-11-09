import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerUser: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('../../src/lib/api/client', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../../src/lib/auth/get-server-user', () => ({ getServerUser: mocks.getServerUser }));

import AdminPage from '../../src/app/(authenticated)/admin/page';

describe('admin page access', () => {
  it.each([null, { role: 'user' }])('redirects a non-admin user', async (user) => {
    mocks.getServerUser.mockResolvedValueOnce(user);

    await expect(AdminPage({ searchParams: {} })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith('/');
  });
});

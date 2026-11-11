import { describe, expect, it, vi } from 'vitest';

import {
  provisionAdministrator,
  type AdminBootstrapRepository,
} from '../../src/infrastructure/database/admin-bootstrap.js';

function repository(exists: boolean, created: boolean): AdminBootstrapRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(exists),
    create: vi.fn().mockResolvedValue(created),
  };
}

describe('administrator bootstrap', () => {
  it('creates a missing administrator with normalized email and an encrypted password', async () => {
    const store = repository(false, true);
    const hash = vi.fn().mockResolvedValue('password-hash');

    await expect(
      provisionAdministrator(
        {
          email: ' ADMIN@EXAMPLE.COM ',
          password: 'Bootstrap-password-123!',
          displayName: 'Primary Admin',
        },
        store,
        hash,
      ),
    ).resolves.toBe('created');

    expect(store.findByEmail).toHaveBeenCalledWith('admin@example.com');
    expect(store.create).toHaveBeenCalledWith({
      email: 'admin@example.com',
      passwordHash: 'password-hash',
      displayName: 'Primary Admin',
    });
  });

  it('refuses to promote an existing account', async () => {
    const store = repository(true, true);
    const hash = vi.fn();

    await expect(
      provisionAdministrator(
        { email: 'admin@example.com', password: 'Bootstrap-password-123!', displayName: 'Admin' },
        store,
        hash,
      ),
    ).rejects.toThrow('existing users are never promoted');

    expect(hash).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
  });

  it('fails a concurrent provisioning conflict', async () => {
    const store = repository(false, false);

    await expect(
      provisionAdministrator(
        { email: 'admin@example.com', password: 'Bootstrap-password-123!', displayName: 'Admin' },
        store,
        vi.fn().mockResolvedValue('password-hash'),
      ),
    ).rejects.toThrow('conflicted with another account');
  });
});

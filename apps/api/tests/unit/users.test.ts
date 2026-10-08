import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { UserRepository } from '../../src/modules/users/user.repository.js';
import { toPublicUser, UserService } from '../../src/modules/users/user.service.js';
import { user } from '../fixtures.js';

describe('users', () => {
  it('exposes only public profile fields and serialized dates', () => {
    const result = toPublicUser(user);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.email).toBe(user.email);
  });

  it('returns not found for an unknown user', async () => {
    const repository = mock<UserRepository>();
    repository.findById.mockResolvedValue(null);
    await expect(new UserService(repository).getPublicUserById(user.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

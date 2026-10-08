import type { User } from '../src/modules/users/user.types.js';

export const user: User = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'person@example.com',
  emailVerified: false,
  passwordHash: 'private-password-hash',
  displayName: 'Person',
  profileImage: 'diamond-kilim',
  desiredColor: 'indigo',
  role: 'user',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=',
  'base64',
);

import type { ChangePasswordRequest, PublicUser, UpdateProfileRequest } from '@template/contracts';

import { hashPassword, verifyPassword } from '../../infrastructure/security/password.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

import type { UserRepository } from './user.repository.js';
import type { User } from './user.types.js';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    profileImage: user.profileImage,
    desiredColor: user.desiredColor,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getPublicUserById(id: string): Promise<PublicUser> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    return toPublicUser(user);
  }

  async updateProfile(id: string, input: UpdateProfileRequest): Promise<PublicUser> {
    const updated = await this.userRepository.update(id, input);
    return toPublicUser(updated);
  }

  async changePassword(id: string, input: ChangePasswordRequest): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    const currentPasswordIsValid = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!currentPasswordIsValid) {
      throw new ValidationError('Current password is incorrect.', {
        currentPassword: ['Current password is incorrect.'],
      });
    }

    const passwordHash = await hashPassword(input.newPassword);
    await this.userRepository.update(id, { passwordHash });
  }
}

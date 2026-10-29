import type { ChangePasswordRequest, PublicUser, UpdateProfileRequest } from '@monthloom/contracts';

import { hashPassword, verifyPassword } from '../../infrastructure/security/password.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

import type { UserRepository } from './user.repository.js';
import type { User } from './user.types.js';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    profileImage: user.profileImage,
    desiredColor: user.desiredColor,
    locale: user.locale,
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
      throw new NotFoundError('User not found.', 'USER_NOT_FOUND');
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
      throw new NotFoundError('User not found.', 'USER_NOT_FOUND');
    }

    const currentPasswordIsValid = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!currentPasswordIsValid) {
      throw new ValidationError(
        'Current password is incorrect.',
        { currentPassword: ['Current password is incorrect.'] },
        'CURRENT_PASSWORD_INCORRECT',
      );
    }

    const passwordHash = await hashPassword(input.newPassword);
    await this.userRepository.update(id, { passwordHash });
  }
}

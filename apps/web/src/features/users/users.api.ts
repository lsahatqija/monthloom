import type { ChangePasswordRequest, PublicUser, UpdateProfileRequest } from '@template/contracts';

import { apiClient } from '../../lib/api/client';

export async function updateProfile(input: UpdateProfileRequest): Promise<{ user: PublicUser }> {
  const data = await apiClient.patch<{ user: PublicUser }>('users/me', input);
  if (!data) throw new Error('Unexpected empty response from updateProfile.');
  return data;
}

export async function changePassword(input: ChangePasswordRequest): Promise<void> {
  await apiClient.put('users/me/password', input);
}

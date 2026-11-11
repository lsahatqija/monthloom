import { hashPassword } from '../security/password.js';

export interface AdminBootstrapRepository {
  findByEmail(email: string): Promise<boolean>;
  create(input: { email: string; passwordHash: string; displayName: string }): Promise<boolean>;
}

export async function provisionAdministrator(
  input: { email: string; password: string; displayName: string },
  repository: AdminBootstrapRepository,
  hash = hashPassword,
): Promise<'created'> {
  const email = input.email.trim().toLowerCase();
  if (await repository.findByEmail(email)) {
    throw new Error(
      'An account with this email already exists; existing users are never promoted.',
    );
  }

  const created = await repository.create({
    email,
    passwordHash: await hash(input.password),
    displayName: input.displayName,
  });
  if (!created) throw new Error('Administrator provisioning conflicted with another account.');
  return 'created';
}

import { eq } from 'drizzle-orm';

import { config } from '../../config/index.js';
import { logger } from '../logging/logger.js';
import { hashPassword } from '../security/password.js';

import { db } from './client.js';
import { users } from './schema/index.js';

export interface AdminBootstrapRepository {
  findByEmail(email: string): Promise<boolean>;
  create(input: { email: string; passwordHash: string; displayName: string }): Promise<boolean>;
}

export async function ensureAdministrator(
  input: { email: string; password: string; displayName: string },
  repository: AdminBootstrapRepository,
  hash = hashPassword,
): Promise<'created' | 'exists'> {
  const email = input.email.trim().toLowerCase();
  if (await repository.findByEmail(email)) return 'exists';

  const created = await repository.create({
    email,
    passwordHash: await hash(input.password),
    displayName: input.displayName,
  });
  return created ? 'created' : 'exists';
}

export async function bootstrapAdministrator(): Promise<void> {
  const { email, password, displayName } = config.adminBootstrap;
  if (!email || !password) return;

  const repository: AdminBootstrapRepository = {
    async findByEmail(candidate) {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, candidate))
        .limit(1);
      return Boolean(user);
    },
    async create(input) {
      const [user] = await db
        .insert(users)
        .values({ ...input, role: 'admin' })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });
      return Boolean(user);
    },
  };

  const result = await ensureAdministrator({ email, password, displayName }, repository);
  logger.info(
    result === 'created'
      ? 'Created configured administrator.'
      : 'Configured administrator already exists.',
  );
}

import { Constants } from '@monthloom/contracts';
import { eq } from 'drizzle-orm';


import { provisionAdministrator, type AdminBootstrapRepository } from './admin-bootstrap.js';
import { closeDatabaseConnection, db } from './client.js';
import { users } from './schema/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readPassword(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks)
    .toString('utf8')
    .replace(/[\r\n]+$/, '');
}

async function main(): Promise<void> {
  const email = argument('email');
  const displayName = argument('display-name') ?? 'Administrator';
  const password = await readPassword();
  if (!email) throw new Error('Pass the administrator email with --email.');
  if (password.length < 15 || password.length > Constants.PASSWORD_MAX_LENGTH) {
    throw new Error(`The initial password must be 15-${Constants.PASSWORD_MAX_LENGTH} characters.`);
  }

  const repository: AdminBootstrapRepository = {
    async findByEmail(candidate) {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, candidate));
      return Boolean(user);
    },
    async create(input) {
      const [user] = await db
        .insert(users)
        .values({ ...input, role: 'admin', mustChangePassword: true, emailVerified: true })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });
      return Boolean(user);
    },
  };

  await provisionAdministrator({ email, password, displayName }, repository);
  process.stdout.write('Administrator created. A password change is required at first login.\n');
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Provisioning failed.'}\n`);
    process.exitCode = 1;
  })
  .finally(closeDatabaseConnection);

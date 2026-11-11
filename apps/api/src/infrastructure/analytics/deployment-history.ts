import type { Database } from '../database/client.js';
import { applicationDeployments } from '../database/schema/index.js';

export async function recordDeployment(
  db: Database,
  version: string,
  deployedAt: string,
): Promise<void> {
  await db
    .insert(applicationDeployments)
    .values({ version, deployedAt: new Date(deployedAt) })
    .onConflictDoNothing();
}

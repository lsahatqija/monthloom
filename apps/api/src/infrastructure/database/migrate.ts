import { logger } from '../logging/logger.js';

import { closeDatabaseConnection } from './client.js';
import { runDatabaseMigrations } from './migration-runner.js';

async function run(): Promise<void> {
  try {
    await runDatabaseMigrations();
  } finally {
    await closeDatabaseConnection();
  }
}

run().catch((error) => {
  logger.error({ err: error }, 'Database migration failed');
  process.exitCode = 1;
});

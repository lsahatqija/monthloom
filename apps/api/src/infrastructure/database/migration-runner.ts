import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { logger } from '../logging/logger.js';

import { db } from './client.js';

const migrationsFolder = fileURLToPath(new URL('./migrations/', import.meta.url));

/** Applies all pending migrations before the API starts accepting requests. */
export async function runDatabaseMigrations(): Promise<void> {
  logger.info('Running database migrations...');
  await migrate(db, { migrationsFolder });
  logger.info('Database migrations completed.');
}

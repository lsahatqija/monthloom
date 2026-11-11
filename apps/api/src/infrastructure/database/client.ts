import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { config } from '../../config/index.js';
import { logger } from '../logging/logger.js';

import * as schema from './schema/index.js';

export const pool = new Pool({ connectionString: config.database.url });

pool.on('connect', () => {
  logger.debug('Database connection established');
});

pool.on('error', (error) => {
  logger.error({ err: error }, 'Unexpected database pool error');
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

/** Used by the readiness endpoint to confirm the database is reachable. */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Database readiness check failed');
    return false;
  }
}

export async function recordOperationalStatus(
  key: string,
  status: 'healthy' | 'degraded' | 'unavailable',
  durationMs: number | null,
  detail: string,
): Promise<void> {
  const now = new Date();
  await pool.query(
    `INSERT INTO operational_status
      (key, status, last_attempt_at, last_success_at, duration_ms, detail)
     VALUES ($1, $2, $3, CASE WHEN $2 = 'healthy' THEN $3 ELSE NULL END, $4, $5)
     ON CONFLICT (key) DO UPDATE SET
       status = EXCLUDED.status,
       last_attempt_at = EXCLUDED.last_attempt_at,
       last_success_at = CASE WHEN EXCLUDED.status = 'healthy' THEN EXCLUDED.last_attempt_at
         ELSE operational_status.last_success_at END,
       duration_ms = EXCLUDED.duration_ms,
       detail = EXCLUDED.detail`,
    [key, status, now, durationMs, detail],
  );
}

export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
  logger.info('Database connection pool closed');
}

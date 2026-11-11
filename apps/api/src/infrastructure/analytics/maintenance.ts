import { sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import type { Logger } from '../logging/logger.js';

export const REQUEST_ROLLUP_RETENTION_DAYS = 400;

export async function cleanExpiredRequestRollups(
  db: Database,
  logger: Logger,
  now = new Date(),
): Promise<void> {
  const cutoff = new Date(now.getTime() - REQUEST_ROLLUP_RETENTION_DAYS * 86_400_000);
  try {
    const result = await db.execute(sql`DELETE FROM request_hourly_rollups WHERE hour < ${cutoff}`);
    logger.info({ deleted: result.rowCount ?? 0, cutoff }, 'Expired request rollups removed');
  } catch (error) {
    logger.warn({ err: error }, 'Expired request rollups could not be removed');
  }
}

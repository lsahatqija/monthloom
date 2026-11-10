import { sql } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';

import { config } from '../../config/index.js';
import type { Database } from '../database/client.js';
import { requestHourlyRollups } from '../database/schema/index.js';
import { safeRouteTemplate } from '../logging/http-logger.js';
import type { Logger } from '../logging/logger.js';

const SAFE_VERSION = /^[A-Za-z0-9._-]{1,40}$/;

export function createRequestTelemetry(db: Database, logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = performance.now();
    res.once('finish', () => {
      const route = safeRouteTemplate(req);
      if (route === '<unmatched>') return;
      const durationMs = Math.max(0, Math.round(performance.now() - started));
      const hour = new Date();
      hour.setUTCMinutes(0, 0, 0);
      const requestedVersion = req.get('x-client-version') ?? '';
      const clientVersion = SAFE_VERSION.test(requestedVersion) ? requestedVersion : 'unknown';
      void db
        .insert(requestHourlyRollups)
        .values({
          hour,
          method: req.method,
          route,
          statusClass: Math.floor(res.statusCode / 100),
          applicationVersion: config.deployment.version,
          clientVersion,
          requestCount: 1,
          durationTotalMs: durationMs,
          durationMaxMs: durationMs,
          databaseTotalMs: 0,
        })
        .onConflictDoUpdate({
          target: [
            requestHourlyRollups.hour,
            requestHourlyRollups.method,
            requestHourlyRollups.route,
            requestHourlyRollups.statusClass,
            requestHourlyRollups.applicationVersion,
            requestHourlyRollups.clientVersion,
          ],
          set: {
            requestCount: sql`${requestHourlyRollups.requestCount} + 1`,
            durationTotalMs: sql`${requestHourlyRollups.durationTotalMs} + ${durationMs}`,
            durationMaxMs: sql`greatest(${requestHourlyRollups.durationMaxMs}, ${durationMs})`,
          },
        })
        .catch((error: unknown) =>
          logger.warn({ err: error, route }, 'Request telemetry was not recorded'),
        );
    });
    next();
  };
}

import type { LivenessResponse, ReadinessResponse } from '@monthloom/contracts';

import { config } from '../../config/index.js';
import type { ProductEventRecorder } from '../../infrastructure/analytics/product-events.js';
import {
  checkDatabaseConnection,
  recordOperationalStatus,
} from '../../infrastructure/database/client.js';

const SERVICE_NAME = 'monthloom-api';
const APP_VERSION = '0.1.0';
const startedAt = Date.now();

function uptimeSeconds(): number {
  return Math.round((Date.now() - startedAt) / 1000);
}

export class SystemService {
  constructor(private readonly productEvents?: ProductEventRecorder) {}

  getLiveness(): LivenessResponse {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: APP_VERSION,
      environment: config.env,
      uptimeSeconds: uptimeSeconds(),
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const started = performance.now();
    const databaseIsUp = await checkDatabaseConnection();
    const durationMs = Math.max(0, Math.round(performance.now() - started));
    await recordOperationalStatus(
      'readiness.database',
      databaseIsUp ? 'healthy' : 'unavailable',
      durationMs,
      databaseIsUp ? 'Database probe succeeded.' : 'Database probe failed.',
    ).catch(() => undefined);
    await this.productEvents?.record({
      eventName: 'readiness.database.checked',
      metadata: { durationMs },
    });

    return {
      status: databaseIsUp ? 'ok' : 'error',
      service: SERVICE_NAME,
      version: APP_VERSION,
      environment: config.env,
      uptimeSeconds: uptimeSeconds(),
      dependencies: { database: databaseIsUp ? 'ok' : 'error' },
    };
  }
}

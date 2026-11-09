import { createHmac } from 'node:crypto';

import { z } from 'zod';

import type { Database } from '../database/client.js';
import { productEvents } from '../database/schema/index.js';
import type { Logger } from '../logging/logger.js';

const eventMetadataSchemas = {
  'user.active': z.object({}).strict(),
  'auth.login.succeeded': z.object({}).strict(),
  'auth.login.failed': z.object({}).strict(),
  'security.rate_limited': z
    .object({ clientKey: z.string().length(64), routeGroup: z.string().max(80) })
    .strict(),
} as const;

export type ApplicationProductEventName = keyof typeof eventMetadataSchemas;

export interface ApplicationProductEvent {
  eventName: ApplicationProductEventName;
  occurredAt?: Date;
  actorUserId?: string;
  metadata?: Record<string, string>;
}

export class ProductEventRecorder {
  constructor(
    private readonly db: Database,
    private readonly logger: Logger,
  ) {}

  async record(event: ApplicationProductEvent): Promise<void> {
    try {
      const metadata = eventMetadataSchemas[event.eventName].parse(event.metadata ?? {});
      await this.db.insert(productEvents).values({
        eventName: event.eventName,
        occurredAt: event.occurredAt,
        actorUserId: event.actorUserId,
        metadata,
      });
    } catch (error) {
      this.logger.warn(
        { err: error, eventName: event.eventName },
        'Product event was not recorded',
      );
    }
  }

  async recordActivity(actorUserId: string, occurredAt = new Date()): Promise<void> {
    try {
      await this.db
        .insert(productEvents)
        .values({
          eventName: 'user.active',
          occurredAt,
          actorUserId,
          activityDate: occurredAt.toISOString().slice(0, 10),
          metadata: {},
        })
        .onConflictDoNothing();
    } catch (error) {
      this.logger.warn({ err: error }, 'Daily activity event was not recorded');
    }
  }
}

let configuredRecorder: ProductEventRecorder | undefined;

export function configureProductEventRecorder(recorder: ProductEventRecorder): void {
  configuredRecorder = recorder;
}

export function recordRateLimitEvent(input: {
  ip?: string;
  routeGroup: string;
  secret: string;
  now?: Date;
}): void {
  const now = input.now ?? new Date();
  const rotation = now.toISOString().slice(0, 10);
  const clientKey = createHmac('sha256', `${input.secret}:${rotation}`)
    .update(input.ip ?? 'unknown')
    .digest('hex');
  void configuredRecorder?.record({
    eventName: 'security.rate_limited',
    occurredAt: now,
    metadata: { clientKey, routeGroup: input.routeGroup },
  });
}

import type { ProductEventRecorder } from '../analytics/product-events.js';
import { recordOperationalStatus } from '../database/client.js';

import type { EmailMessage, EmailSender } from './email-sender.js';

export class InstrumentedEmailSender implements EmailSender {
  constructor(
    private readonly sender: EmailSender,
    private readonly events: ProductEventRecorder,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const started = performance.now();
    try {
      await this.sender.send(message);
    } catch (error) {
      const duration = Math.round(performance.now() - started);
      await Promise.all([
        this.events.record({
          eventName: 'email.delivery.failed',
          metadata: { template: message.label },
        }),
        recordOperationalStatus('email.delivery', 'degraded', duration, 'Latest delivery failed.'),
      ]).catch(() => undefined);
      throw error;
    }

    const duration = Math.round(performance.now() - started);
    await Promise.all([
      this.events.record({
        eventName: 'email.delivery.succeeded',
        metadata: { template: message.label },
      }),
      recordOperationalStatus(
        'email.delivery',
        'healthy',
        duration,
        'Latest delivery succeeded.',
      ),
    ]).catch(() => undefined);
  }
}

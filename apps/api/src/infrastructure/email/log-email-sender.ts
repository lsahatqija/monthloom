import type { Logger } from '../logging/logger.js';

import type { EmailMessage, EmailSender } from './email-sender.js';

/** Safe local transport: records delivery metadata without logging links or tokens. */
export class LogEmailSender implements EmailSender {
  constructor(private readonly logger: Logger) {}

  async send(message: EmailMessage): Promise<void> {
    this.logger.info(
      { email: { to: message.to, template: message.label } },
      'Email captured by log transport',
    );
  }
}

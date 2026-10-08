import { Resend } from 'resend';

import type { AppConfig } from '../../config/index.js';

import type { EmailMessage, EmailSender } from './email-sender.js';

type EmailConfig = AppConfig['email'];

export class ResendEmailSender implements EmailSender {
  private readonly client: Resend;

  constructor(private readonly config: EmailConfig) {
    if (!config.resendApiKey) {
      throw new Error('RESEND_API_KEY is required when EMAIL_TRANSPORT=resend.');
    }

    this.client = new Resend(config.resendApiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const sender = {
      from: `${this.config.from.name} <${this.config.from.address}>`,
      to: message.to,
      replyTo: this.config.replyTo,
    };
    const result =
      message.kind === 'template'
        ? await this.client.emails.send({
            ...sender,
            template: { id: message.templateId, variables: message.variables },
          })
        : await this.client.emails.send({
            ...sender,
            subject: message.subject,
            text: message.text,
            html: message.html,
          });

    if (result.error) {
      throw new Error(`Resend rejected the email: ${result.error.message}`, {
        cause: result.error,
      });
    }
  }
}

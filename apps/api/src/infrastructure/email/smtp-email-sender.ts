import nodemailer, { type Transporter } from 'nodemailer';

import type { AppConfig } from '../../config/index.js';

import type { EmailMessage, EmailSender } from './email-sender.js';

type EmailConfig = AppConfig['email'];

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(private readonly config: EmailConfig) {
    if (!config.smtp.host) {
      throw new Error('SMTP_HOST is required when EMAIL_TRANSPORT=smtp.');
    }
    if (
      (config.smtp.user && !config.smtp.password) ||
      (!config.smtp.user && config.smtp.password)
    ) {
      throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together.');
    }

    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth:
        config.smtp.user && config.smtp.password
          ? { user: config.smtp.user, pass: config.smtp.password }
          : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      replyTo: this.config.replyTo,
      ...message,
    });
  }
}

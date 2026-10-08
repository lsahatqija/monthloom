export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Delivery boundary for transactional email providers. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

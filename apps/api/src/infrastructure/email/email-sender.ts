interface EmailMessageBase {
  to: string;
  label: string;
}

export interface RenderedEmailMessage extends EmailMessageBase {
  kind: 'rendered';
  subject: string;
  text: string;
  html: string;
}

export interface TemplateEmailMessage extends EmailMessageBase {
  kind: 'template';
  templateId: string;
  variables: Record<string, string | number>;
}

export type EmailMessage = RenderedEmailMessage | TemplateEmailMessage;

/** Delivery boundary for transactional email providers. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

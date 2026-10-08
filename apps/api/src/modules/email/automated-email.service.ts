import type { EmailSender } from '../../infrastructure/email/index.js';

import { resendTemplateAliases } from './resend-template-definitions.js';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  );
}

export interface LinkEmailInput {
  to: string;
  displayName: string;
  url: string;
}

export interface WelcomeEmailInput {
  to: string;
  displayName: string;
  verificationUrl: string;
  expiresIn: string;
}

export interface PasswordResetEmailInput extends LinkEmailInput {
  expiresIn: string;
}

export interface HouseholdInvitationEmailInput {
  to: string;
  inviterName: string;
  householdName: string;
  invitationUrl: string;
  expiresAt: Date;
}

export interface MonthlyReportEmailInput {
  to: string;
  displayName: string;
  householdName: string;
  monthLabel: string;
  income: string;
  expenses: string;
  leftover: string;
  reportUrl: string;
}

/** Composes all product email in one place and delegates provider-specific delivery. */
export class AutomatedEmailService {
  constructor(private readonly sender: EmailSender) {}

  sendWelcome(input: WelcomeEmailInput): Promise<void> {
    return this.sender.send({
      kind: 'template',
      label: 'welcome',
      to: input.to,
      templateId: resendTemplateAliases.welcome,
      variables: {
        DISPLAY_NAME: escapeHtml(input.displayName),
        VERIFICATION_URL: escapeHtml(input.verificationUrl),
        EXPIRES_IN: escapeHtml(input.expiresIn),
      },
    });
  }

  sendAccountVerification(input: LinkEmailInput & { expiresIn: string }): Promise<void> {
    return this.sender.send({
      kind: 'template',
      label: 'account-verification',
      to: input.to,
      templateId: resendTemplateAliases.emailVerification,
      variables: {
        DISPLAY_NAME: escapeHtml(input.displayName),
        VERIFICATION_URL: escapeHtml(input.url),
        EXPIRES_IN: escapeHtml(input.expiresIn),
      },
    });
  }

  sendPasswordReset(input: PasswordResetEmailInput): Promise<void> {
    return this.sender.send({
      kind: 'template',
      label: 'password-reset',
      to: input.to,
      templateId: resendTemplateAliases.passwordReset,
      variables: {
        DISPLAY_NAME: escapeHtml(input.displayName),
        RESET_URL: escapeHtml(input.url),
        EXPIRES_IN: escapeHtml(input.expiresIn),
      },
    });
  }

  sendHouseholdInvitation(input: HouseholdInvitationEmailInput): Promise<void> {
    return this.sender.send({
      kind: 'template',
      label: 'household-invitation',
      to: input.to,
      templateId: resendTemplateAliases.householdInvitation,
      variables: {
        INVITER_NAME: escapeHtml(input.inviterName),
        HOUSEHOLD_NAME: escapeHtml(input.householdName),
        INVITATION_URL: escapeHtml(input.invitationUrl),
        EXPIRES_AT: escapeHtml(input.expiresAt.toISOString()),
      },
    });
  }

  sendMonthlyReport(input: MonthlyReportEmailInput): Promise<void> {
    return this.sender.send({
      kind: 'template',
      label: 'monthly-balance',
      to: input.to,
      templateId: resendTemplateAliases.monthlyBalance,
      variables: {
        DISPLAY_NAME: escapeHtml(input.displayName),
        HOUSEHOLD_NAME: escapeHtml(input.householdName),
        MONTH_LABEL: escapeHtml(input.monthLabel),
        INCOME: escapeHtml(input.income),
        EXPENSES: escapeHtml(input.expenses),
        LEFTOVER: escapeHtml(input.leftover),
        REPORT_URL: escapeHtml(input.reportUrl),
      },
    });
  }
}

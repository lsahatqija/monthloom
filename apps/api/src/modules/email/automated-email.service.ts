import type { Locale } from '@monthloom/contracts';

import type { EmailSender } from '../../infrastructure/email/index.js';

import { localizedTemplateAlias, resendTemplateAliases } from './resend-template-definitions.js';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  );
}

function formatDateTime(value: Date, locale: Locale): string {
  return escapeHtml(
    new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    }).format(value),
  );
}

function formatMonth(month: string, locale: Locale): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return escapeHtml(
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year!, monthNumber! - 1, 1)),
    ),
  );
}

function formatMoney(value: string | number, currency: string, locale: Locale): string {
  return escapeHtml(
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value)),
  );
}

export interface LinkEmailInput {
  to: string;
  displayName: string;
  url: string;
  locale: Locale;
}

export interface WelcomeEmailInput {
  to: string;
  displayName: string;
  verificationUrl: string;
  expiresAt: Date;
  locale: Locale;
}

export interface PasswordResetEmailInput extends LinkEmailInput {
  expiresAt: Date;
}

export interface HouseholdInvitationEmailInput {
  to: string;
  inviterName: string;
  householdName: string;
  invitationUrl: string;
  expiresAt: Date;
  locale: Locale;
}

export interface MonthlyReportEmailInput {
  to: string;
  displayName: string;
  householdName: string;
  month: string;
  currency: string;
  income: string | number;
  expenses: string | number;
  leftover: string | number;
  reportUrl: string;
  locale: Locale;
}

export interface FeedbackEmailInput {
  to: string;
  feedbackType: string;
  feedback: string;
  identity?: {
    userId: string;
    userEmail: string;
    displayName: string;
  };
}

/** Composes all product email in one place and delegates provider-specific delivery. */
export class AutomatedEmailService {
  constructor(private readonly sender: EmailSender) {}

  sendWelcome(input: WelcomeEmailInput): Promise<void> {
    return this.sender.send({
      kind: 'template',
      label: 'welcome',
      to: input.to,
      templateId: localizedTemplateAlias('welcome', input.locale),
      variables: {
        DISPLAY_NAME: escapeHtml(input.displayName),
        VERIFICATION_URL: escapeHtml(input.verificationUrl),
        EXPIRES_AT: formatDateTime(input.expiresAt, input.locale),
      },
    });
  }

  sendAccountVerification(input: LinkEmailInput & { expiresAt: Date }): Promise<void> {
    return this.sender.send({
      kind: 'template',
      label: 'account-verification',
      to: input.to,
      templateId: localizedTemplateAlias('email-verification', input.locale),
      variables: {
        DISPLAY_NAME: escapeHtml(input.displayName),
        VERIFICATION_URL: escapeHtml(input.url),
        EXPIRES_AT: formatDateTime(input.expiresAt, input.locale),
      },
    });
  }

  sendPasswordReset(input: PasswordResetEmailInput): Promise<void> {
    return this.sender.send({
      kind: 'template',
      label: 'password-reset',
      to: input.to,
      templateId: localizedTemplateAlias('password-reset', input.locale),
      variables: {
        DISPLAY_NAME: escapeHtml(input.displayName),
        RESET_URL: escapeHtml(input.url),
        EXPIRES_AT: formatDateTime(input.expiresAt, input.locale),
      },
    });
  }

  sendHouseholdInvitation(input: HouseholdInvitationEmailInput): Promise<void> {
    return this.sender.send({
      kind: 'template',
      label: 'household-invitation',
      to: input.to,
      templateId: localizedTemplateAlias('household-invitation', input.locale),
      variables: {
        INVITER_NAME: escapeHtml(input.inviterName),
        HOUSEHOLD_NAME: escapeHtml(input.householdName),
        INVITATION_URL: escapeHtml(input.invitationUrl),
        EXPIRES_AT: formatDateTime(input.expiresAt, input.locale),
      },
    });
  }

  sendMonthlyReport(input: MonthlyReportEmailInput): Promise<void> {
    return this.sender.send({
      kind: 'template',
      label: 'monthly-balance',
      to: input.to,
      templateId: localizedTemplateAlias('monthly-balance', input.locale),
      variables: {
        DISPLAY_NAME: escapeHtml(input.displayName),
        HOUSEHOLD_NAME: escapeHtml(input.householdName),
        MONTH_LABEL: formatMonth(input.month, input.locale),
        INCOME: formatMoney(input.income, input.currency, input.locale),
        EXPENSES: formatMoney(input.expenses, input.currency, input.locale),
        LEFTOVER: formatMoney(input.leftover, input.currency, input.locale),
        REPORT_URL: escapeHtml(input.reportUrl),
      },
    });
  }

  sendFeedback(input: FeedbackEmailInput): Promise<void> {
    const submitter = input.identity
      ? `<strong>${escapeHtml(input.identity.displayName)}</strong> (${escapeHtml(input.identity.userEmail)})`
      : '<strong>Anonymous user</strong>';
    const userReference = input.identity
      ? `<p style="color:#74675e;font-size:13px">User ID: ${escapeHtml(input.identity.userId)}</p>`
      : '';

    return this.sender.send({
      kind: 'template',
      label: 'feedback',
      to: input.to,
      templateId: resendTemplateAliases.feedback,
      variables: {
        FEEDBACK_TYPE: escapeHtml(input.feedbackType),
        FEEDBACK: escapeHtml(input.feedback).replace(/\r?\n/g, '<br>'),
        SUBMITTER: submitter,
        USER_REFERENCE: userReference,
      },
    });
  }
}

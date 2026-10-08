import type { EmailMessage, EmailSender } from '../../infrastructure/email/index.js';

import { resendTemplateAliases } from './resend-template-definitions.js';

const BRAND_COLOR = '#78553d';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  );
}

function layout(preview: string, heading: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(preview)}</title></head>
  <body style="margin:0;background:#f4efe9;color:#30261f;font-family:Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:16px"><tr><td style="padding:32px">
        <p style="margin:0 0 24px;color:${BRAND_COLOR};font-size:20px;font-weight:700">Monthloom</p>
        <h1 style="margin:0 0 20px;font-size:28px">${escapeHtml(heading)}</h1>
        ${body}
        <p style="margin:32px 0 0;color:#74675e;font-size:13px">This is an automated message from Monthloom.</p>
      </td></tr></table>
    </td></tr></table>
  </body>
</html>`;
}

function actionButton(label: string, url: string): string {
  return `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">${escapeHtml(label)}</a></p>`;
}

export interface LinkEmailInput {
  to: string;
  displayName: string;
  url: string;
}

export interface WelcomeEmailInput {
  to: string;
  displayName: string;
  dashboardUrl: string;
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
        DASHBOARD_URL: escapeHtml(input.dashboardUrl),
      },
    });
  }

  sendAccountVerification(input: LinkEmailInput): Promise<void> {
    return this.sender.send(
      this.linkEmail(
        input,
        'Verify your Monthloom account',
        'Verify your email',
        'Confirm that this email address belongs to you.',
        'Verify email',
      ),
    );
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

  private linkEmail(
    input: LinkEmailInput,
    subject: string,
    heading: string,
    copy: string,
    action: string,
  ): EmailMessage {
    return {
      kind: 'rendered',
      label: 'account-verification',
      to: input.to,
      subject,
      text: `Hi ${input.displayName},\n\n${copy}\n\n${input.url}`,
      html: layout(
        subject,
        heading,
        `<p>Hi ${escapeHtml(input.displayName)},</p><p style="line-height:1.6">${escapeHtml(copy)}</p>${actionButton(action, input.url)}`,
      ),
    };
  }
}

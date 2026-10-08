import type { EmailMessage, EmailSender } from '../../infrastructure/email/index.js';

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

  sendPasswordReset(input: LinkEmailInput): Promise<void> {
    return this.sender.send(
      this.linkEmail(
        input,
        'Reset your Monthloom password',
        'Reset your password',
        'Use the secure link below to choose a new password. If you did not request this, you can ignore this email.',
        'Reset password',
      ),
    );
  }

  sendHouseholdInvitation(input: HouseholdInvitationEmailInput): Promise<void> {
    const expires = input.expiresAt.toISOString();
    const subject = `${input.inviterName} invited you to ${input.householdName}`;
    const intro = `${input.inviterName} invited you to join the ${input.householdName} household on Monthloom.`;
    return this.sender.send({
      to: input.to,
      subject,
      text: `${intro}\n\nAccept the invitation: ${input.invitationUrl}\n\nThis single-use invitation expires at ${expires}.`,
      html: layout(
        subject,
        `Join ${input.householdName}`,
        `<p style="line-height:1.6">${escapeHtml(intro)}</p>${actionButton('Accept invitation', input.invitationUrl)}<p style="color:#74675e;font-size:14px">This single-use invitation expires at ${escapeHtml(expires)}.</p>`,
      ),
    });
  }

  sendMonthlyReport(input: MonthlyReportEmailInput): Promise<void> {
    const subject = `${input.householdName}: ${input.monthLabel} report`;
    return this.sender.send({
      to: input.to,
      subject,
      text: `Hi ${input.displayName},\n\n${input.monthLabel} for ${input.householdName}\nIncome: ${input.income}\nExpenses: ${input.expenses}\nLeft over: ${input.leftover}\n\nView report: ${input.reportUrl}`,
      html: layout(
        subject,
        `${input.monthLabel} at a glance`,
        `<p>Hi ${escapeHtml(input.displayName)},</p><p><strong>${escapeHtml(input.householdName)}</strong></p><ul><li>Income: ${escapeHtml(input.income)}</li><li>Expenses: ${escapeHtml(input.expenses)}</li><li>Left over: ${escapeHtml(input.leftover)}</li></ul>${actionButton('View full report', input.reportUrl)}`,
      ),
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

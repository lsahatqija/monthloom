const BRAND_COLOR = '#78553d';

function layout(preview: string, heading: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${preview}</title></head>
  <body style="margin:0;background:#f4efe9;color:#30261f;font-family:Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:16px"><tr><td style="padding:32px">
        <p style="margin:0 0 24px;color:${BRAND_COLOR};font-size:20px;font-weight:700">Monthloom</p>
        <h1 style="margin:0 0 20px;font-size:28px">${heading}</h1>
        ${body}
        <p style="margin:32px 0 0;color:#74675e;font-size:13px">This is an automated message from Monthloom.</p>
      </td></tr></table>
    </td></tr></table>
  </body>
</html>`;
}

function button(label: string, urlVariable: string): string {
  return `<p style="margin:28px 0"><a href="{{{${urlVariable}}}}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">${label}</a></p>`;
}

const variable = (key: string) => ({ key, type: 'string' as const });

export const resendTemplateAliases = {
  welcome: 'monthloom-welcome',
  passwordReset: 'monthloom-password-reset',
  householdInvitation: 'monthloom-household-invitation',
  monthlyBalance: 'monthloom-monthly-balance',
} as const;

export const resendTemplateDefinitions = [
  {
    name: 'Monthloom welcome',
    alias: resendTemplateAliases.welcome,
    subject: 'Welcome to Monthloom',
    html: layout(
      'Your Monthloom account is ready.',
      'Welcome to Monthloom',
      `<p style="line-height:1.6">Hi {{{DISPLAY_NAME}}},</p><p style="line-height:1.6">Your account is ready. Start organizing your household finances and building a clearer monthly picture.</p>${button('Open Monthloom', 'DASHBOARD_URL')}`,
    ),
    variables: [variable('DISPLAY_NAME'), variable('DASHBOARD_URL')],
  },
  {
    name: 'Monthloom password reset',
    alias: resendTemplateAliases.passwordReset,
    subject: 'Reset your Monthloom password',
    html: layout(
      'Use your secure link to reset your Monthloom password.',
      'Reset your password',
      `<p style="line-height:1.6">Hi {{{DISPLAY_NAME}}},</p><p style="line-height:1.6">We received a request to reset your password. Use the secure link below within {{{EXPIRES_IN}}}. If you did not request this, you can safely ignore this email.</p>${button('Reset password', 'RESET_URL')}`,
    ),
    variables: [variable('DISPLAY_NAME'), variable('RESET_URL'), variable('EXPIRES_IN')],
  },
  {
    name: 'Monthloom household invitation',
    alias: resendTemplateAliases.householdInvitation,
    subject: 'You have been invited to a Monthloom household',
    html: layout(
      'You have a new household invitation.',
      'Join {{{HOUSEHOLD_NAME}}}',
      `<p style="line-height:1.6">{{{INVITER_NAME}}} invited you to join the <strong>{{{HOUSEHOLD_NAME}}}</strong> household on Monthloom.</p>${button('Accept invitation', 'INVITATION_URL')}<p style="color:#74675e;font-size:14px">This single-use invitation expires at {{{EXPIRES_AT}}}.</p>`,
    ),
    variables: [
      variable('INVITER_NAME'),
      variable('HOUSEHOLD_NAME'),
      variable('INVITATION_URL'),
      variable('EXPIRES_AT'),
    ],
  },
  {
    name: 'Monthloom monthly balance report',
    alias: resendTemplateAliases.monthlyBalance,
    subject: 'Your Monthloom monthly balance report',
    html: layout(
      'Your monthly household balance is ready.',
      '{{{MONTH_LABEL}}} at a glance',
      `<p style="line-height:1.6">Hi {{{DISPLAY_NAME}}},</p><p style="line-height:1.6"><strong>{{{HOUSEHOLD_NAME}}}</strong></p><table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="background:#f8f5f1;border-radius:8px"><tr><td>Income</td><td align="right"><strong>{{{INCOME}}}</strong></td></tr><tr><td>Expenses</td><td align="right"><strong>{{{EXPENSES}}}</strong></td></tr><tr><td>Left over</td><td align="right"><strong>{{{LEFTOVER}}}</strong></td></tr></table>${button('View full report', 'REPORT_URL')}`,
    ),
    variables: [
      variable('DISPLAY_NAME'),
      variable('HOUSEHOLD_NAME'),
      variable('MONTH_LABEL'),
      variable('INCOME'),
      variable('EXPENSES'),
      variable('LEFTOVER'),
      variable('REPORT_URL'),
    ],
  },
] as const;

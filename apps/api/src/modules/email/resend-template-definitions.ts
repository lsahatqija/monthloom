import { Constants, type Locale } from '@monthloom/contracts';

const BRAND_COLOR = '#78553d';
type Copy = {
  footer: string;
  welcome: string[];
  verification: string[];
  reset: string[];
  invitation: string[];
  monthly: string[];
};

// Each array is subject, preview, heading, body, action, and optional expiry copy.
const copy: Record<Locale, Copy> = {
  en: {
    footer: 'This is an automated message from Monthloom.',
    welcome: [
      'Welcome to Monthloom',
      'Your Monthloom account is ready.',
      'Welcome to Monthloom',
      "Your account is ready. Verify your email address to enable Monthloom's email features.",
      'Open Monthloom',
      'This verification link expires at {{{EXPIRES_AT}}}.',
    ],
    verification: [
      'Verify your Monthloom email address',
      'Verify your email address to use Monthloom email features.',
      'Verify your email',
      "Confirm that this email address belongs to you to enable Monthloom's email features.",
      'Verify email',
      'This verification link expires at {{{EXPIRES_AT}}}.',
    ],
    reset: [
      'Reset your Monthloom password',
      'Use your secure link to reset your Monthloom password.',
      'Reset your password',
      'We received a request to reset your password. Use the secure link below before {{{EXPIRES_AT}}}. If you did not request this, you can safely ignore this email.',
      'Reset password',
    ],
    invitation: [
      'You have been invited to a Monthloom household',
      'You have a new household invitation.',
      'Join {{{HOUSEHOLD_NAME}}}',
      '{{{INVITER_NAME}}} invited you to join the <strong>{{{HOUSEHOLD_NAME}}}</strong> household on Monthloom.',
      'Accept invitation',
      'This single-use invitation expires at {{{EXPIRES_AT}}}.',
    ],
    monthly: [
      'Your Monthloom monthly balance report',
      'Your monthly household balance is ready.',
      '{{{MONTH_LABEL}}} at a glance',
      'Income',
      'Expenses',
      'Left over',
      'View full report',
    ],
  },
  sq: {
    footer: 'Ky është një mesazh automatik nga Monthloom.',
    welcome: [
      'Mirë se vini në Monthloom',
      'Llogaria juaj në Monthloom është gati.',
      'Mirë se vini në Monthloom',
      'Llogaria juaj është gati. Verifikoni adresën e emailit për të aktivizuar veçoritë e emailit.',
      'Hap Monthloom',
      'Kjo lidhje verifikimi skadon më {{{EXPIRES_AT}}}.',
    ],
    verification: [
      'Verifikoni emailin tuaj në Monthloom',
      'Verifikoni adresën tuaj të emailit.',
      'Verifikoni emailin tuaj',
      'Konfirmoni se kjo adresë emaili ju përket juve.',
      'Verifiko emailin',
      'Kjo lidhje verifikimi skadon më {{{EXPIRES_AT}}}.',
    ],
    reset: [
      'Rivendosni fjalëkalimin në Monthloom',
      'Përdorni lidhjen e sigurt për të rivendosur fjalëkalimin.',
      'Rivendosni fjalëkalimin',
      'Morëm një kërkesë për të rivendosur fjalëkalimin tuaj. Përdorni lidhjen para {{{EXPIRES_AT}}}. Nëse nuk e kërkuat këtë, shpërfilleni këtë email.',
      'Rivendos fjalëkalimin',
    ],
    invitation: [
      'Jeni ftuar në një familje në Monthloom',
      'Keni një ftesë të re familjare.',
      'Bashkohuni me {{{HOUSEHOLD_NAME}}}',
      '{{{INVITER_NAME}}} ju ftoi të bashkoheni me familjen <strong>{{{HOUSEHOLD_NAME}}}</strong> në Monthloom.',
      'Prano ftesën',
      'Kjo ftesë njëpërdorimëshe skadon më {{{EXPIRES_AT}}}.',
    ],
    monthly: [
      'Raporti juaj mujor në Monthloom',
      'Bilanci mujor i familjes suaj është gati.',
      '{{{MONTH_LABEL}}} me një vështrim',
      'Të ardhura',
      'Shpenzime',
      'Të mbetura',
      'Shiko raportin e plotë',
    ],
  },
  fr: {
    footer: 'Ceci est un message automatique de Monthloom.',
    welcome: [
      'Bienvenue sur Monthloom',
      'Votre compte Monthloom est prêt.',
      'Bienvenue sur Monthloom',
      'Votre compte est prêt. Vérifiez votre adresse e-mail pour activer les fonctionnalités de messagerie.',
      'Ouvrir Monthloom',
      'Ce lien de vérification expire le {{{EXPIRES_AT}}}.',
    ],
    verification: [
      'Vérifiez votre adresse e-mail Monthloom',
      'Vérifiez votre adresse e-mail.',
      'Vérifiez votre e-mail',
      'Confirmez que cette adresse e-mail vous appartient.',
      "Vérifier l'e-mail",
      'Ce lien de vérification expire le {{{EXPIRES_AT}}}.',
    ],
    reset: [
      'Réinitialisez votre mot de passe Monthloom',
      'Utilisez votre lien sécurisé pour réinitialiser votre mot de passe.',
      'Réinitialisez votre mot de passe',
      "Nous avons reçu une demande de réinitialisation. Utilisez le lien avant le {{{EXPIRES_AT}}}. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
      'Réinitialiser le mot de passe',
    ],
    invitation: [
      'Vous êtes invité à rejoindre un foyer Monthloom',
      'Vous avez reçu une nouvelle invitation.',
      'Rejoignez {{{HOUSEHOLD_NAME}}}',
      '{{{INVITER_NAME}}} vous invite à rejoindre le foyer <strong>{{{HOUSEHOLD_NAME}}}</strong> sur Monthloom.',
      "Accepter l'invitation",
      'Cette invitation à usage unique expire le {{{EXPIRES_AT}}}.',
    ],
    monthly: [
      'Votre rapport mensuel Monthloom',
      'Le bilan mensuel de votre foyer est prêt.',
      '{{{MONTH_LABEL}}} en un coup d’œil',
      'Revenus',
      'Dépenses',
      'Solde',
      'Voir le rapport complet',
    ],
  },
  tr: {
    footer: 'Bu, Monthloom tarafından gönderilen otomatik bir mesajdır.',
    welcome: [
      "Monthloom'a hoş geldiniz",
      'Monthloom hesabınız hazır.',
      "Monthloom'a hoş geldiniz",
      'Hesabınız hazır. E-posta özelliklerini etkinleştirmek için adresinizi doğrulayın.',
      "Monthloom'u aç",
      'Bu doğrulama bağlantısının süresi {{{EXPIRES_AT}}} tarihinde dolar.',
    ],
    verification: [
      'Monthloom e-posta adresinizi doğrulayın',
      'E-posta adresinizi doğrulayın.',
      'E-postanızı doğrulayın',
      'Bu e-posta adresinin size ait olduğunu doğrulayın.',
      'E-postayı doğrula',
      'Bu doğrulama bağlantısının süresi {{{EXPIRES_AT}}} tarihinde dolar.',
    ],
    reset: [
      'Monthloom parolanızı sıfırlayın',
      'Güvenli bağlantınızla parolanızı sıfırlayın.',
      'Parolanızı sıfırlayın',
      'Parolanızı sıfırlama isteği aldık. Bağlantıyı {{{EXPIRES_AT}}} tarihinden önce kullanın. Bu isteği siz yapmadıysanız e-postayı yok sayın.',
      'Parolayı sıfırla',
    ],
    invitation: [
      'Bir Monthloom hanesine davet edildiniz',
      'Yeni bir hane davetiniz var.',
      '{{{HOUSEHOLD_NAME}}} hanesine katılın',
      '{{{INVITER_NAME}}}, sizi <strong>{{{HOUSEHOLD_NAME}}}</strong> hanesine davet etti.',
      'Daveti kabul et',
      'Bu davetin süresi {{{EXPIRES_AT}}} tarihinde dolar.',
    ],
    monthly: [
      'Monthloom aylık bakiye raporunuz',
      'Hanenizin aylık bakiyesi hazır.',
      'Bir bakışta {{{MONTH_LABEL}}}',
      'Gelir',
      'Giderler',
      'Kalan',
      'Tam raporu görüntüle',
    ],
  },
  de: {
    footer: 'Dies ist eine automatisierte Nachricht von Monthloom.',
    welcome: [
      'Willkommen bei Monthloom',
      'Ihr Monthloom-Konto ist bereit.',
      'Willkommen bei Monthloom',
      'Ihr Konto ist bereit. Bestätigen Sie Ihre E-Mail-Adresse, um die E-Mail-Funktionen von Monthloom zu aktivieren.',
      'Monthloom öffnen',
      'Dieser Bestätigungslink läuft am {{{EXPIRES_AT}}} ab.',
    ],
    verification: [
      'Bestätigen Sie Ihre Monthloom-E-Mail-Adresse',
      'Bestätigen Sie Ihre E-Mail-Adresse, um die E-Mail-Funktionen von Monthloom zu nutzen.',
      'E-Mail-Adresse bestätigen',
      'Bestätigen Sie, dass diese E-Mail-Adresse Ihnen gehört.',
      'E-Mail bestätigen',
      'Dieser Bestätigungslink läuft am {{{EXPIRES_AT}}} ab.',
    ],
    reset: [
      'Setzen Sie Ihr Monthloom-Passwort zurück',
      'Verwenden Sie Ihren sicheren Link, um Ihr Monthloom-Passwort zurückzusetzen.',
      'Passwort zurücksetzen',
      'Wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten. Verwenden Sie den sicheren Link vor {{{EXPIRES_AT}}}. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.',
      'Passwort zurücksetzen',
    ],
    invitation: [
      'Sie wurden zu einem Monthloom-Haushalt eingeladen',
      'Sie haben eine neue Haushaltseinladung.',
      '{{{HOUSEHOLD_NAME}}} beitreten',
      '{{{INVITER_NAME}}} hat Sie eingeladen, dem Haushalt <strong>{{{HOUSEHOLD_NAME}}}</strong> auf Monthloom beizutreten.',
      'Einladung annehmen',
      'Diese einmalig verwendbare Einladung läuft am {{{EXPIRES_AT}}} ab.',
    ],
    monthly: [
      'Ihr monatlicher Monthloom-Saldobericht',
      'Der monatliche Saldo Ihres Haushalts ist bereit.',
      '{{{MONTH_LABEL}}} im Überblick',
      'Einnahmen',
      'Ausgaben',
      'Übrig',
      'Vollständigen Bericht anzeigen',
    ],
  },
};

function layout(locale: Locale, preview: string, heading: string, body: string, footer: string) {
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${preview}</title></head><body style="margin:0;background:#f4efe9;color:#30261f;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${preview}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:16px"><tr><td style="padding:32px"><p style="margin:0 0 24px;color:${BRAND_COLOR};font-size:20px;font-weight:700">Monthloom</p><h1 style="margin:0 0 20px;font-size:28px">${heading}</h1>${body}<p style="margin:32px 0 0;color:#74675e;font-size:13px">${footer}</p></td></tr></table></td></tr></table></body></html>`;
}

const button = (label: string, variable: string) =>
  `<p style="margin:28px 0"><a href="{{{${variable}}}}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">${label}</a></p>`;
const variable = (key: string) => ({ key, type: 'string' as const });
const paragraph = (value: string) => `<p style="line-height:1.6">${value}</p>`;

export type UserEmailTemplate =
  'welcome' | 'email-verification' | 'password-reset' | 'household-invitation' | 'monthly-balance';
export const localizedTemplateAlias = (template: UserEmailTemplate, locale: Locale) =>
  `monthloom-${template}-${locale}`;
export const resendTemplateAliases = { feedback: 'monthloom-feedback' } as const;

function localizedDefinitions(locale: Locale) {
  const c = copy[locale];
  const greeting =
    locale === 'en'
      ? 'Hi'
      : locale === 'fr'
        ? 'Bonjour'
        : locale === 'tr'
          ? 'Merhaba'
          : locale === 'de'
            ? 'Hallo'
            : 'Përshëndetje';
  return [
    {
      name: `Monthloom welcome (${locale})`,
      alias: localizedTemplateAlias('welcome', locale),
      subject: c.welcome[0]!,
      html: layout(
        locale,
        c.welcome[1]!,
        c.welcome[2]!,
        paragraph(`${greeting} {{{DISPLAY_NAME}}},`) +
          paragraph(c.welcome[3]!) +
          button(c.welcome[4]!, 'VERIFICATION_URL') +
          paragraph(c.welcome[5]!),
        c.footer,
      ),
      variables: [variable('DISPLAY_NAME'), variable('VERIFICATION_URL'), variable('EXPIRES_AT')],
    },
    {
      name: `Monthloom email verification (${locale})`,
      alias: localizedTemplateAlias('email-verification', locale),
      subject: c.verification[0]!,
      html: layout(
        locale,
        c.verification[1]!,
        c.verification[2]!,
        paragraph(`${greeting} {{{DISPLAY_NAME}}},`) +
          paragraph(c.verification[3]!) +
          button(c.verification[4]!, 'VERIFICATION_URL') +
          paragraph(c.verification[5]!),
        c.footer,
      ),
      variables: [variable('DISPLAY_NAME'), variable('VERIFICATION_URL'), variable('EXPIRES_AT')],
    },
    {
      name: `Monthloom password reset (${locale})`,
      alias: localizedTemplateAlias('password-reset', locale),
      subject: c.reset[0]!,
      html: layout(
        locale,
        c.reset[1]!,
        c.reset[2]!,
        paragraph(`${greeting} {{{DISPLAY_NAME}}},`) +
          paragraph(c.reset[3]!) +
          button(c.reset[4]!, 'RESET_URL'),
        c.footer,
      ),
      variables: [variable('DISPLAY_NAME'), variable('RESET_URL'), variable('EXPIRES_AT')],
    },
    {
      name: `Monthloom household invitation (${locale})`,
      alias: localizedTemplateAlias('household-invitation', locale),
      subject: c.invitation[0]!,
      html: layout(
        locale,
        c.invitation[1]!,
        c.invitation[2]!,
        paragraph(c.invitation[3]!) +
          button(c.invitation[4]!, 'INVITATION_URL') +
          paragraph(c.invitation[5]!),
        c.footer,
      ),
      variables: [
        variable('INVITER_NAME'),
        variable('HOUSEHOLD_NAME'),
        variable('INVITATION_URL'),
        variable('EXPIRES_AT'),
      ],
    },
    {
      name: `Monthloom monthly balance report (${locale})`,
      alias: localizedTemplateAlias('monthly-balance', locale),
      subject: c.monthly[0]!,
      html: layout(
        locale,
        c.monthly[1]!,
        c.monthly[2]!,
        paragraph(`${greeting} {{{DISPLAY_NAME}}},`) +
          paragraph('<strong>{{{HOUSEHOLD_NAME}}}</strong>') +
          `<table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="background:#f8f5f1;border-radius:8px"><tr><td>${c.monthly[3]}</td><td align="right"><strong>{{{INCOME}}}</strong></td></tr><tr><td>${c.monthly[4]}</td><td align="right"><strong>{{{EXPENSES}}}</strong></td></tr><tr><td>${c.monthly[5]}</td><td align="right"><strong>{{{LEFTOVER}}}</strong></td></tr></table>` +
          button(c.monthly[6]!, 'REPORT_URL'),
        c.footer,
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
  ];
}

const feedbackDefinition = {
  name: 'Monthloom feedback',
  alias: resendTemplateAliases.feedback,
  subject: 'Monthloom Feedback: {{{FEEDBACK_TYPE}}}',
  html: layout(
    'en',
    'New feedback was submitted through Monthloom.',
    'New {{{FEEDBACK_TYPE}}}',
    paragraph('{{{SUBMITTER}}} submitted feedback from inside Monthloom.') +
      '<div style="margin:24px 0;padding:20px;border:1px solid #ded5cc;border-radius:10px;background:#f8f5f1;line-height:1.65;overflow-wrap:anywhere">{{{FEEDBACK}}}</div>{{{USER_REFERENCE}}}',
    copy.en.footer,
  ),
  variables: [
    variable('FEEDBACK_TYPE'),
    variable('FEEDBACK'),
    variable('SUBMITTER'),
    variable('USER_REFERENCE'),
  ],
};

export const resendTemplateDefinitions = [
  ...Constants.SUPPORTED_LOCALES.flatMap(localizedDefinitions),
  feedbackDefinition,
];

export function selectResendTemplateDefinitions(requestedAlias?: string) {
  return requestedAlias
    ? resendTemplateDefinitions.filter((definition) => definition.alias === requestedAlias)
    : resendTemplateDefinitions;
}

import { Resend } from 'resend';

import { config } from '../../config/index.js';
import { resendTemplateDefinitions } from '../../modules/email/resend-template-definitions.js';

async function syncTemplates(): Promise<void> {
  const managementKey = config.email.resendAdminKey ?? config.email.resendApiKey;
  if (!managementKey) {
    throw new Error(
      'Set RESEND_ADMIN_KEY (preferred) or RESEND_API_KEY in the repository .env before syncing email templates.',
    );
  }

  const resend = new Resend(managementKey);
  const from = `${config.email.from.name} <${config.email.from.address}>`;

  for (const definition of resendTemplateDefinitions) {
    const payload = {
      name: definition.name,
      alias: definition.alias,
      from,
      replyTo: config.email.replyTo,
      subject: definition.subject,
      html: definition.html,
      variables: definition.variables.map((item) => ({ ...item })),
    };
    const existing = await resend.templates.get(definition.alias);

    if (existing.data) {
      const updated = await resend.templates.update(definition.alias, payload);
      if (updated.error) {
        throw new Error(`Could not update ${definition.alias}: ${updated.error.message}`);
      }
      const published = await resend.templates.publish(definition.alias);
      if (published.error) {
        throw new Error(`Could not publish ${definition.alias}: ${published.error.message}`);
      }
      console.info(`Updated and published ${definition.alias} (${updated.data.id})`);
      continue;
    }

    if (existing.error.statusCode !== 404) {
      throw new Error(`Could not inspect ${definition.alias}: ${existing.error.message}`);
    }

    const created = await resend.templates.create(payload).publish();
    if (created.error) {
      throw new Error(`Could not create ${definition.alias}: ${created.error.message}`);
    }
    console.info(`Created and published ${definition.alias} (${created.data.id})`);
  }
}

syncTemplates().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

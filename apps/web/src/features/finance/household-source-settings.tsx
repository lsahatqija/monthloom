'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Alert, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { financeKeys, getHouseholds } from './finance.api';
import { SourceSettings } from './source-settings';

function errorMessage(error: unknown, fallback: string): string {
  return isApiClientError(error) ? error.message : fallback;
}

export function HouseholdSourceSettings() {
  const t = useTranslations('Finance');
  const query = useQuery({ queryKey: financeKeys.households(), queryFn: getHouseholds });

  if (query.isPending) return <LoadingIndicator label={t('loadingHouseholds')} />;
  if (query.isError)
    return <Alert variant="error">{errorMessage(query.error, t('genericError'))}</Alert>;
  if (!query.data.length) {
    return (
      <section className="settingsView" aria-labelledby="source-settings-heading">
        <div className="settingsViewHeading">
          <h2 id="source-settings-heading">{t('sources')}</h2>
          <p>{t('createHouseholdBeforeSources')}</p>
        </div>
      </section>
    );
  }

  return <SourceSettings households={query.data} />;
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Alert, LoadingIndicator } from '../../components/ui/index';
import { useApiErrorMessage } from '../../lib/api/localized-error';

import { financeKeys, getHouseholds } from './finance.api';
import { SourceSettings } from './source-settings';

export function HouseholdSourceSettings() {
  const t = useTranslations('Finance');
  const errorMessage = useApiErrorMessage();
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

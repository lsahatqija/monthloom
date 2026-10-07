'use client';

import { useQuery } from '@tanstack/react-query';

import { Alert, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { financeKeys, getHouseholds } from './finance.api';
import { SourceSettings } from './source-settings';

function errorMessage(error: unknown): string {
  return isApiClientError(error) ? error.message : 'Something went wrong. Please try again.';
}

export function HouseholdSourceSettings() {
  const query = useQuery({ queryKey: financeKeys.households(), queryFn: getHouseholds });

  if (query.isPending) return <LoadingIndicator label="Loading households…" />;
  if (query.isError) return <Alert variant="error">{errorMessage(query.error)}</Alert>;
  if (!query.data.length) {
    return (
      <section className="settingsView" aria-labelledby="source-settings-heading">
        <div className="settingsViewHeading">
          <h2 id="source-settings-heading">Sources</h2>
          <p>Create a household before adding or managing sources.</p>
        </div>
      </section>
    );
  }

  return <SourceSettings households={query.data} />;
}

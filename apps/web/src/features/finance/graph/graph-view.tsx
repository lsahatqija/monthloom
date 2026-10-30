'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { Alert } from '../../../components/ui';
import { useHouseholds, useHouseholdTransactionRange } from '../api/queries';
import { resolveHouseholdId } from '../selectors/household-picker';

import { aggregateBalance } from './aggregation/balance';
import { aggregateCategories } from './aggregation/category';
import { aggregateOverview } from './aggregation/overview';
import { GraphControls } from './graph-controls';
import { dashboardHrefFromGraph } from './selection-links';
import { useGraphSelection } from './use-graph-selection';

const ChartSurface = dynamic(() => import('./chart-surface'), { ssr: false });

function LoadingSurface({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="graphLoadingFrame" aria-live="polite">
      {visible ? (
        <div className="graphLoadingContent" role="status">
          <span>{label}</span>
        </div>
      ) : null}
    </div>
  );
}

export function GraphView() {
  const t = useTranslations('Graph');
  const typeLabels = useTranslations('Labels.expenseTypes');
  const selection = useGraphSelection();
  const { householdId, setHouseholdId } = selection;
  const householdsQuery = useHouseholds();
  const activeHouseholdId = householdsQuery.data
    ? resolveHouseholdId(householdsQuery.data, householdId)
    : '';

  useEffect(() => {
    if (activeHouseholdId && activeHouseholdId !== householdId) {
      setHouseholdId(activeHouseholdId);
    }
  }, [activeHouseholdId, householdId, setHouseholdId]);

  const rangeQuery = useHouseholdTransactionRange(activeHouseholdId, selection.from, selection.to);
  const transactions = useMemo(
    () => rangeQuery.data?.transactions ?? [],
    [rangeQuery.data?.transactions],
  );
  const members = useMemo(() => rangeQuery.data?.members ?? [], [rangeQuery.data?.members]);
  const aggregation = useMemo(() => {
    if (selection.graph === 'category') {
      const result = aggregateCategories({
        transactions,
        grouping: selection.categoryGrouping,
        typeLabel: (type) => typeLabels(type),
      });
      return { itemCount: result.groups.length, empty: result.groups.length === 0 };
    }
    if (selection.graph === 'overview') {
      const result = aggregateOverview({
        transactions,
        members,
        selectedUserIds: selection.userIds,
        kind: selection.overviewKind,
        mode: selection.overviewMode,
        typeLabel: (type) => typeLabels(type),
        combinedLabel: t('combined'),
      });
      return { itemCount: result.dimensions.length, empty: result.dimensions.length === 0 };
    }
    const result = aggregateBalance({
      transactions,
      from: selection.fromDate,
      to: selection.toDate,
      mode: selection.balanceMode,
    });
    return { itemCount: result.points.length, empty: transactions.length === 0 };
  }, [members, selection, t, transactions, typeLabels]);

  const pageHeader = (
    <header className="graphPageHeader">
      <div>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </div>
      <Link className="graphHomeLink" href={dashboardHrefFromGraph(selection)}>
        {t('backHome')}
      </Link>
    </header>
  );

  if (householdsQuery.isPending) {
    return (
      <section className="graphPage">
        {pageHeader}
        <LoadingSurface label={t('loading')} />
      </section>
    );
  }

  if (householdsQuery.isError) {
    return (
      <section className="graphPage">
        {pageHeader}
        <Alert variant="error">
          {t('loadHouseholdsError')}{' '}
          <button
            type="button"
            className="graphTextButton"
            onClick={() => householdsQuery.refetch()}
          >
            {t('retry')}
          </button>
        </Alert>
      </section>
    );
  }

  if (!householdsQuery.data?.length) {
    return (
      <section className="graphPage">
        {pageHeader}
        <div className="graphStatePanel">
          <h2>{t('noHouseholds')}</h2>
          <p>{t('noHouseholdsDescription')}</p>
          <Link href="/settings/households" className="button">
            {t('openSettings')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="graphPage" aria-busy={rangeQuery.isFetching}>
      {pageHeader}
      <GraphControls households={householdsQuery.data} members={members} selection={selection} />

      {rangeQuery.isPending ? <LoadingSurface label={t('loading')} /> : null}
      {rangeQuery.isError ? (
        <div className="graphStatePanel graphErrorPanel" role="alert">
          <h2>{t('loadErrorTitle')}</h2>
          <p>{t('loadErrorDescription')}</p>
          <button type="button" className="graphTextButton" onClick={() => rangeQuery.refetch()}>
            {t('retry')}
          </button>
        </div>
      ) : null}
      {rangeQuery.data && !transactions.length ? (
        <div className="graphStatePanel">
          <h2>{t('emptyPeriodTitle')}</h2>
          <p>{t('emptyPeriodDescription')}</p>
        </div>
      ) : null}
      {rangeQuery.data && transactions.length && aggregation.empty ? (
        <div className="graphStatePanel">
          <h2>{t('emptyGraphTitle')}</h2>
          <p>{t('emptyGraphDescription', { graph: t(`graphs.${selection.graph}`) })}</p>
        </div>
      ) : null}
      {rangeQuery.data && !aggregation.empty ? (
        <div className="graphWorkspace">
          <div className="graphSurfaceHeader">
            <div>
              <h2>{t(`graphs.${selection.graph}`)}</h2>
              <p>{t('periodSummary', { from: selection.from, to: selection.to })}</p>
            </div>
            {rangeQuery.isFetching ? <span role="status">{t('updating')}</span> : null}
          </div>
          <ChartSurface
            label={t('chartPlaceholderLabel', {
              graph: t(`graphs.${selection.graph}`),
              count: aggregation.itemCount,
            })}
          />
          <div className="graphSupplement">
            <section aria-labelledby="graph-legend-title">
              <h3 id="graph-legend-title">{t('legend')}</h3>
              <p>{t('legendPlaceholder')}</p>
            </section>
            <section aria-labelledby="graph-table-title">
              <h3 id="graph-table-title">{t('dataTable')}</h3>
              <p>{t('tablePlaceholder')}</p>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}

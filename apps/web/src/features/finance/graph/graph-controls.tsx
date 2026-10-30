'use client';

import type { HouseholdTransactionRangeResponse, ManagedHousehold } from '@monthloom/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { graphMonthBounds, type GraphPeriodPreset } from './period';
import {
  BALANCE_CHARTS,
  BALANCE_MODES,
  CATEGORY_CHARTS,
  CATEGORY_GROUPINGS,
  GRAPH_KINDS,
  OVERVIEW_KINDS,
  OVERVIEW_MODES,
  type useGraphSelection,
} from './use-graph-selection';

type Selection = ReturnType<typeof useGraphSelection>;
type Member = HouseholdTransactionRangeResponse['members'][number];

function Segmented<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: Value; label: string }>;
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset className="graphSegmented">
      <legend>{label}</legend>
      <div className="graphSegmentedTrack">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={label}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Select<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: ReadonlyArray<{ value: Value; label: string }>;
  onChange: (value: Value) => void;
}) {
  return (
    <label className="graphField">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as Value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function GraphControls({
  households,
  members,
  selection,
}: {
  households: ManagedHousehold[];
  members: Member[];
  selection: Selection;
}) {
  const t = useTranslations('Graph');
  const { minimum, maximum } = graphMonthBounds();
  const [draftFrom, setDraftFrom] = useState(selection.from);
  const [draftTo, setDraftTo] = useState(selection.to);

  useEffect(() => {
    if (selection.error) return;
    setDraftFrom(selection.from);
    setDraftTo(selection.to);
  }, [selection.error, selection.from, selection.to]);

  const selectedUsers = selection.userIds.length
    ? new Set(selection.userIds)
    : new Set(members.map(({ id }) => id));
  const toggleUser = (userId: string) => {
    const next = new Set(selectedUsers);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    selection.setUserIds(
      next.size ? members.filter(({ id }) => next.has(id)).map(({ id }) => id) : [],
    );
  };
  const periodOptions: Array<{ value: GraphPeriodPreset; label: string }> = [
    'current-month',
    'last-month',
    'current-year',
    'last-year',
    'last-12-months',
    'custom-month',
    'custom-period',
  ].map((value) => ({ value: value as GraphPeriodPreset, label: t(`periods.${value}`) }));

  return (
    <div className="graphControls" aria-label={t('controls')}>
      <div className="graphControlRow graphControlRowPrimary">
        <Select
          label={t('household')}
          value={selection.householdId}
          onChange={selection.setHouseholdId}
          options={households.map((household) => ({
            value: household.id,
            label: household.name,
          }))}
        />
        <Select
          label={t('period')}
          value={selection.period}
          onChange={selection.setPeriod}
          options={periodOptions}
        />
        <Select
          label={t('graph')}
          value={selection.graph}
          onChange={selection.setGraph}
          options={GRAPH_KINDS.map((value) => ({ value, label: t(`graphs.${value}`) }))}
        />
      </div>

      {selection.period === 'custom-month' ? (
        <label className="graphField graphDateField">
          <span>{t('month')}</span>
          <input
            type="month"
            min={minimum}
            max={maximum}
            value={draftFrom}
            onChange={(event) => {
              setDraftFrom(event.target.value);
              setDraftTo(event.target.value);
              selection.setCustomMonth(event.target.value);
            }}
          />
        </label>
      ) : null}

      {selection.period === 'custom-period' ? (
        <div className="graphDateRange">
          <label className="graphField graphDateField">
            <span>{t('from')}</span>
            <input
              type="month"
              min={minimum}
              max={maximum}
              value={draftFrom}
              aria-describedby={selection.error ? 'graph-period-error' : undefined}
              onChange={(event) => {
                setDraftFrom(event.target.value);
                selection.setCustomPeriod(event.target.value, draftTo);
              }}
            />
          </label>
          <label className="graphField graphDateField">
            <span>{t('to')}</span>
            <input
              type="month"
              min={minimum}
              max={maximum}
              value={draftTo}
              aria-describedby={selection.error ? 'graph-period-error' : undefined}
              onChange={(event) => {
                setDraftTo(event.target.value);
                selection.setCustomPeriod(draftFrom, event.target.value);
              }}
            />
          </label>
        </div>
      ) : null}
      {selection.error ? (
        <p id="graph-period-error" className="graphValidation" role="alert">
          {t(`periodErrors.${selection.error}`)}
        </p>
      ) : null}

      <div className="graphContextControls">
        {selection.graph === 'balance' ? (
          <>
            <Segmented
              label={t('chartType')}
              value={selection.balanceChart}
              onChange={selection.setBalanceChart}
              options={BALANCE_CHARTS.map((value) => ({
                value,
                label: t(`balanceCharts.${value}`),
              }))}
            />
            <Segmented
              label={t('calculation')}
              value={selection.balanceMode}
              onChange={selection.setBalanceMode}
              options={BALANCE_MODES.map((value) => ({ value, label: t(`balanceModes.${value}`) }))}
            />
          </>
        ) : null}
        {selection.graph === 'category' ? (
          <>
            <Segmented
              label={t('groupBy')}
              value={selection.categoryGrouping}
              onChange={selection.setCategoryGrouping}
              options={CATEGORY_GROUPINGS.map((value) => ({
                value,
                label: t(`groupings.${value}`),
              }))}
            />
            <Segmented
              label={t('chartType')}
              value={selection.categoryChart}
              onChange={selection.setCategoryChart}
              options={CATEGORY_CHARTS.map((value) => ({
                value,
                label: t(`categoryCharts.${value}`),
              }))}
            />
          </>
        ) : null}
        {selection.graph === 'overview' ? (
          <>
            <Segmented
              label={t('transactionKind')}
              value={selection.overviewKind}
              onChange={selection.setOverviewKind}
              options={OVERVIEW_KINDS.map((value) => ({
                value,
                label: t(`overviewKinds.${value}`),
              }))}
            />
            <Segmented
              label={t('userPresentation')}
              value={selection.overviewMode}
              onChange={selection.setOverviewMode}
              options={OVERVIEW_MODES.map((value) => ({
                value,
                label: t(`overviewModes.${value}`),
              }))}
            />
            <fieldset className="graphUsers">
              <legend>{t('users')}</legend>
              <div>
                {members.map((member) => (
                  <label key={member.id}>
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(member.id)}
                      onChange={() => toggleUser(member.id)}
                    />
                    <span>{member.displayName}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        ) : null}
      </div>
    </div>
  );
}

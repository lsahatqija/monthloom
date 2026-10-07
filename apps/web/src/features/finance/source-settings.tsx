'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HouseholdSource, ManagedHousehold } from '@template/contracts';
import { useEffect, useState } from 'react';

import { Alert, Button, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import {
  copyHouseholdSources,
  deleteHouseholdSource,
  financeKeys,
  getHouseholdSources,
} from './finance.api';
import { SourceModal } from './source-modal';

function errorMessage(error: unknown): string {
  return isApiClientError(error) ? error.message : 'Something went wrong. Please try again.';
}

interface CopySourcesModalProps {
  households: ManagedHousehold[];
  initialSourceHouseholdId: string;
  onClose: () => void;
  onComplete: (message: string) => void;
}

function CopySourcesModal({
  households,
  initialSourceHouseholdId,
  onClose,
  onComplete,
}: CopySourcesModalProps) {
  const queryClient = useQueryClient();
  const [sourceHouseholdId, setSourceHouseholdId] = useState(initialSourceHouseholdId);
  const [targetHouseholdId, setTargetHouseholdId] = useState(
    households.find((household) => household.id !== initialSourceHouseholdId)?.id ?? '',
  );
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const sourceQuery = useQuery({
    queryKey: financeKeys.sources(sourceHouseholdId),
    queryFn: () => getHouseholdSources(sourceHouseholdId),
    enabled: Boolean(sourceHouseholdId),
  });
  const copyMutation = useMutation({
    mutationFn: () =>
      copyHouseholdSources(sourceHouseholdId, {
        targetHouseholdId,
        sourceIds: [...selectedSourceIds],
      }),
    onSuccess: async ({ copiedCount, skippedCount }) => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      onComplete(
        `${copiedCount} ${copiedCount === 1 ? 'source was' : 'sources were'} copied${
          skippedCount ? `; ${skippedCount} already existed and were skipped` : ''
        }.`,
      );
    },
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !copyMutation.isPending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copyMutation.isPending, onClose]);

  const setSourceHousehold = (householdId: string) => {
    setSourceHouseholdId(householdId);
    setSelectedSourceIds(new Set());
    if (householdId === targetHouseholdId) {
      setTargetHouseholdId(households.find((household) => household.id !== householdId)?.id ?? '');
    }
  };

  return (
    <div
      className="transactionModalBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !copyMutation.isPending) onClose();
      }}
    >
      <section
        className="transactionModal copySourcesModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-sources-title"
      >
        <div className="transactionModalHeader">
          <div>
            <p className="transactionModalEyebrow">Household sources</p>
            <h2 id="copy-sources-title">Copy Sources</h2>
          </div>
          <button
            type="button"
            className="modalCloseButton"
            disabled={copyMutation.isPending}
            onClick={onClose}
            aria-label="Close copy sources modal"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="copySourcesContent">
          <div className="copyHouseholdSelectors">
            <label>
              <span>From household</span>
              <select
                value={sourceHouseholdId}
                disabled={copyMutation.isPending}
                onChange={(event) => setSourceHousehold(event.target.value)}
              >
                {households.map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>To household</span>
              <select
                value={targetHouseholdId}
                disabled={copyMutation.isPending}
                onChange={(event) => setTargetHouseholdId(event.target.value)}
              >
                {households
                  .filter((household) => household.id !== sourceHouseholdId)
                  .map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {sourceQuery.isPending ? <LoadingIndicator label="Loading sources…" /> : null}
          {sourceQuery.isError ? (
            <Alert variant="error">{errorMessage(sourceQuery.error)}</Alert>
          ) : null}
          {sourceQuery.data ? (
            <div className="sourceTableScroll">
              <table className="sourceTable copySourceTable">
                <thead>
                  <tr>
                    <th scope="col">Copy</th>
                    <th scope="col">Display name</th>
                    <th scope="col">Aliases</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceQuery.data.map((source) => (
                    <tr key={source.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Copy ${source.displayName}`}
                          checked={selectedSourceIds.has(source.id)}
                          disabled={copyMutation.isPending}
                          onChange={(event) =>
                            setSelectedSourceIds((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(source.id);
                              else next.delete(source.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td>{source.displayName}</td>
                      <td>{source.aliases.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sourceQuery.data.length === 0 ? (
                <p className="sourceTableEmpty">This household has no sources to copy.</p>
              ) : null}
            </div>
          ) : null}

          {copyMutation.isError ? (
            <Alert variant="error">{errorMessage(copyMutation.error)}</Alert>
          ) : null}

          <div className="transactionFormActions">
            <Button
              type="button"
              variant="secondary"
              disabled={copyMutation.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                copyMutation.isPending || !targetHouseholdId || selectedSourceIds.size === 0
              }
              onClick={() => copyMutation.mutate()}
            >
              {copyMutation.isPending ? 'Copying…' : 'Copy selected sources'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function SourceSettings({ households }: { households: ManagedHousehold[] }) {
  const queryClient = useQueryClient();
  const [householdId, setHouseholdId] = useState(
    households.find((household) => household.isPrimary)?.id ?? households[0]?.id ?? '',
  );
  const [editingSource, setEditingSource] = useState<HouseholdSource | null>(null);
  const [copying, setCopying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceQuery = useQuery({
    queryKey: financeKeys.sources(householdId),
    queryFn: () => getHouseholdSources(householdId),
    enabled: Boolean(householdId),
  });
  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => deleteHouseholdSource(householdId, sourceId),
    onSuccess: async () => {
      setError(null);
      setNotice('Source deleted.');
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  useEffect(() => {
    if (households.some((household) => household.id === householdId)) return;
    setHouseholdId(
      households.find((household) => household.isPrimary)?.id ?? households[0]?.id ?? '',
    );
  }, [householdId, households]);

  if (!households.length) return null;

  return (
    <section className="sourceSettings" aria-labelledby="source-settings-heading">
      <div className="settingsSectionHeading sourceSettingsHeading">
        <div>
          <h2 id="source-settings-heading">Manage Sources</h2>
          <p>Edit, remove, or copy sources between households.</p>
        </div>
        <Button
          type="button"
          disabled={households.length < 2}
          title={households.length < 2 ? 'Join another household to copy sources.' : undefined}
          onClick={() => {
            setNotice(null);
            setCopying(true);
          }}
        >
          Copy Sources
        </Button>
      </div>

      <label className="sourceHouseholdPicker">
        <span>Household</span>
        <select
          value={householdId}
          onChange={(event) => {
            setHouseholdId(event.target.value);
            setError(null);
            setNotice(null);
          }}
        >
          {households.map((household) => (
            <option key={household.id} value={household.id}>
              {household.name}
            </option>
          ))}
        </select>
      </label>

      {notice ? <Alert>{notice}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {sourceQuery.isPending ? <LoadingIndicator label="Loading sources…" /> : null}
      {sourceQuery.isError ? (
        <Alert variant="error">{errorMessage(sourceQuery.error)}</Alert>
      ) : null}
      {sourceQuery.data ? (
        <div className="sourceTableScroll sourceManagementTable">
          <table className="sourceTable">
            <thead>
              <tr>
                <th scope="col">Display name</th>
                <th scope="col">Key</th>
                <th scope="col">Aliases</th>
                <th scope="col">
                  <span className="srOnly">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sourceQuery.data.map((source) => (
                <tr key={source.id}>
                  <td>
                    <strong>{source.displayName}</strong>
                  </td>
                  <td>
                    <code>{source.key}</code>
                  </td>
                  <td>{source.aliases.join(', ')}</td>
                  <td className="sourceTableActions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingSource(source)}
                    >
                      Edit
                    </Button>
                    <button
                      type="button"
                      className="textDangerButton"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete ${source.displayName}?`)) {
                          setNotice(null);
                          deleteMutation.mutate(source.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sourceQuery.data.length === 0 ? (
            <p className="sourceTableEmpty">This household has no sources yet.</p>
          ) : null}
        </div>
      ) : null}

      {editingSource ? (
        <SourceModal
          householdId={householdId}
          source={editingSource}
          onClose={() => setEditingSource(null)}
          onSaved={() => {
            setEditingSource(null);
            setError(null);
            setNotice('Source updated.');
          }}
        />
      ) : null}
      {copying ? (
        <CopySourcesModal
          households={households}
          initialSourceHouseholdId={householdId}
          onClose={() => setCopying(false)}
          onComplete={(message) => {
            setCopying(false);
            setError(null);
            setNotice(message);
          }}
        />
      ) : null}
    </section>
  );
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Constants,
  type CreateHouseholdSourceRequest,
  type HouseholdSource,
} from '@template/contracts';
import { useEffect, useState, type FormEvent } from 'react';

import { Alert, Button } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { createHouseholdSource, financeKeys, updateHouseholdSource } from './finance.api';

interface SourceModalProps {
  householdId: string;
  source?: HouseholdSource;
  onClose: () => void;
  onSaved: (source: HouseholdSource) => void;
}

export function SourceModal({ householdId, source, onClose, onSaved }: SourceModalProps) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(source?.displayName ?? '');
  const [aliases, setAliases] = useState(() => {
    const additionalAliases = source?.aliases.filter((alias) => alias !== source.displayName) ?? [];
    return additionalAliases.length ? additionalAliases : [''];
  });
  const mutation = useMutation({
    mutationFn: (input: CreateHouseholdSourceRequest) =>
      source
        ? updateHouseholdSource(householdId, source.id, input)
        : createHouseholdSource(householdId, input),
    onSuccess: async ({ source: savedSource }) => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      onSaved(savedSource);
    },
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !mutation.isPending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mutation.isPending, onClose]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({
      displayName,
      aliases: aliases.filter((alias) => alias.trim().length > 0),
    });
  };

  return (
    <div
      className="transactionModalBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <section
        className="transactionModal sourceModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-modal-title"
      >
        <div className="transactionModalHeader">
          <div>
            <p className="transactionModalEyebrow">
              {source ? 'Update transaction source' : 'New transaction source'}
            </p>
            <h2 id="source-modal-title">{source ? 'Edit source' : 'Add new source'}</h2>
          </div>
          <button
            type="button"
            className="modalCloseButton"
            disabled={mutation.isPending}
            onClick={onClose}
            aria-label="Close source modal"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form className="transactionForm sourceForm" onSubmit={submit}>
          <label className="transactionField">
            <span>Source Display Name</span>
            <input
              value={displayName}
              maxLength={Constants.DISPLAY_NAME_MAX_LENGTH}
              placeholder="e.g. Neighborhood Market"
              autoFocus
              required
              disabled={mutation.isPending}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          <fieldset className="sourceAliases">
            <legend>Aliases</legend>
            <p>
              Add names that may appear on bank records. The display name is always included as an
              alias.
            </p>
            <label className="transactionField">
              <span>Display name alias</span>
              <input value={displayName} disabled readOnly placeholder="Display name" />
            </label>
            {aliases.map((alias, index) => (
              <div className="sourceAliasRow" key={index}>
                <label className="transactionField">
                  <span>Alias {index + 1}</span>
                  <input
                    value={alias}
                    maxLength={Constants.DISPLAY_NAME_MAX_LENGTH}
                    placeholder="e.g. NBRHD MKT 1042"
                    disabled={mutation.isPending}
                    onChange={(event) =>
                      setAliases((current) =>
                        current.map((value, aliasIndex) =>
                          aliasIndex === index ? event.target.value : value,
                        ),
                      )
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={mutation.isPending || aliases.length === 1}
                  onClick={() =>
                    setAliases((current) =>
                      current.filter((_value, aliasIndex) => aliasIndex !== index),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            {aliases.length < Constants.SOURCE_ALIAS_MAX_COUNT - 1 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => setAliases((current) => [...current, ''])}
              >
                Add alias
              </Button>
            ) : null}
          </fieldset>

          {mutation.isError ? (
            <Alert variant="error">
              {isApiClientError(mutation.error)
                ? mutation.error.message
                : `We could not ${source ? 'update' : 'create'} this source.`}
            </Alert>
          ) : null}

          <div className="transactionFormActions">
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !displayName.trim()}>
              {mutation.isPending ? 'Saving…' : source ? 'Save changes' : 'Add source'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

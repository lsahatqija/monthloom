'use client';

import {
  Constants,
  type CreateHouseholdSourceRequest,
  type HouseholdSource,
} from '@monthloom/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';

import { Alert, Button } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { createHouseholdSource, financeKeys, updateHouseholdSource } from './finance.api';

interface SourceModalProps {
  householdId: string;
  initialDisplayName?: string;
  source?: HouseholdSource;
  onClose: () => void;
  onSaved: (source: HouseholdSource) => void;
}

export function SourceModal({
  householdId,
  initialDisplayName = '',
  source,
  onClose,
  onSaved,
}: SourceModalProps) {
  const t = useTranslations('Finance');
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(source?.displayName ?? initialDisplayName);
  const [aliases, setAliases] = useState(
    () => source?.aliases.filter((alias) => alias !== source.displayName) ?? [],
  );
  const mutation = useMutation({
    mutationFn: (input: CreateHouseholdSourceRequest) =>
      source
        ? updateHouseholdSource(householdId, source.id, input)
        : createHouseholdSource(householdId, input),
    onSuccess: async ({ source: savedSource }) => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      window.dispatchEvent(new CustomEvent('monthloom:onboarding', { detail: 'source-saved' }));
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
        data-onboarding="source-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-modal-title"
      >
        <div className="transactionModalHeader">
          <div>
            <p className="transactionModalEyebrow">
              {source ? t('updateTransactionSource') : t('newTransactionSource')}
            </p>
            <h2 id="source-modal-title">{source ? t('editSource') : t('addNewSource')}</h2>
          </div>
          <button
            type="button"
            className="modalCloseButton"
            data-onboarding="source-modal-close"
            disabled={mutation.isPending}
            onClick={onClose}
            aria-label={t('closeSourceModal')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form className="transactionForm sourceForm" onSubmit={submit}>
          <label className="transactionField">
            <span>{t('sourceDisplayName')}</span>
            <input
              value={displayName}
              maxLength={Constants.DISPLAY_NAME_MAX_LENGTH}
              placeholder={t('sourceNameExample')}
              autoFocus
              required
              disabled={mutation.isPending}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          <fieldset className="sourceAliases">
            <legend>{t('aliases')}</legend>
            <p>{t('aliasesDescription')}</p>
            {aliases.map((alias, index) => (
              <div className="sourceAliasRow" key={index}>
                <label className="transactionField">
                  <span>{t('aliasNumber', { number: index + 1 })}</span>
                  <input
                    value={alias}
                    maxLength={Constants.DISPLAY_NAME_MAX_LENGTH}
                    placeholder={t('aliasExample')}
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
                  disabled={mutation.isPending}
                  onClick={() =>
                    setAliases((current) =>
                      current.filter((_value, aliasIndex) => aliasIndex !== index),
                    )
                  }
                >
                  {t('remove')}
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
                {t('addAlias')}
              </Button>
            ) : null}
          </fieldset>

          {mutation.isError ? (
            <Alert variant="error">
              {isApiClientError(mutation.error)
                ? mutation.error.message
                : source
                  ? t('updateSourceError')
                  : t('createSourceError')}
            </Alert>
          ) : null}

          <div className="transactionFormActions">
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !displayName.trim()}>
              {mutation.isPending ? t('saving') : source ? t('saveChanges') : t('addSource')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

'use client';

import type { HouseholdTransaction, TransactionEditScope } from '@monthloom/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { MotionState } from '../../../components/motion/use-motion-presence';
import { Alert, Button } from '../../../components/ui/index';
import { financeErrorMessage } from '../api/errors';
import { financeKeys, removeHouseholdTransaction } from '../finance.api';

export function RemoveTransactionDialog({
  householdId,
  transaction,
  onClose,
  motionState = 'entered',
}: {
  householdId: string;
  transaction: HouseholdTransaction;
  onClose: () => void;
  motionState?: MotionState;
}) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<TransactionEditScope>(
    transaction.recurring ? 'current_and_future' : 'current',
  );
  const mutation = useMutation({
    mutationFn: () => removeHouseholdTransaction(householdId, transaction.id, scope),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      onClose();
    },
  });

  return (
    <div
      className="transactionModalBackdrop"
      data-motion={motionState}
      aria-hidden={motionState === 'exiting' ? 'true' : undefined}
      inert={motionState === 'exiting' ? ('' as unknown as boolean) : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="transactionModal confirmationModal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-transaction-title"
      >
        <div className="transactionModalHeader">
          <div>
            <p className="transactionModalEyebrow">Remove entry</p>
            <h2 id="remove-transaction-title">Remove transaction?</h2>
          </div>
          <button type="button" className="modalCloseButton" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="removeTransactionContent">
          <p>
            This will remove <strong>{transaction.source.displayName}</strong> for{' '}
            <strong>{transaction.amount}</strong>.
          </p>
          {transaction.recurring ? (
            <fieldset className="transactionScope">
              <legend>Which transactions should be removed?</legend>
              <label>
                <input
                  type="radio"
                  name="removeScope"
                  checked={scope === 'current_and_future'}
                  onChange={() => setScope('current_and_future')}
                />
                Current and future transactions
              </label>
              <label>
                <input
                  type="radio"
                  name="removeScope"
                  checked={scope === 'past_current_and_future'}
                  onChange={() => setScope('past_current_and_future')}
                />
                Past, current and future transactions
              </label>
            </fieldset>
          ) : null}
          {mutation.isError ? (
            <Alert variant="error">
              {financeErrorMessage(mutation.error, 'We could not remove this transaction.')}
            </Alert>
          ) : null}
          <div className="transactionFormActions">
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

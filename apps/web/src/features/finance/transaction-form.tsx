'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Constants,
  type CreateHouseholdTransactionRequest,
  type HouseholdMonthResponse,
} from '@template/contracts';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { Alert, Button } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';
import { useCurrentUser } from '../auth/use-current-user';

import { createHouseholdTransaction, financeKeys } from './finance.api';
import { FinancialIcon, financialIconLabel } from './financial-icon';

const COLOR_OPTIONS = ['#35675B', '#33805C', '#45658B', '#67558A', '#C47A3A', '#C4473A'];

function transactionDate(month: string): string {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (month !== currentMonth) return `${month}-01`;
  return `${currentMonth}-${String(today.getDate()).padStart(2, '0')}`;
}

interface TransactionFormProps {
  householdId: string;
  month: string;
  members: HouseholdMonthResponse['members'];
  sources: HouseholdMonthResponse['sources'];
  onClose: () => void;
}

export function TransactionForm({
  householdId,
  month,
  members,
  sources,
  onClose,
}: TransactionFormProps) {
  const sourceListId = useId();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CreateHouseholdTransactionRequest['kind']>('expense');
  const [source, setSource] = useState('');
  const [icon, setIcon] = useState<CreateHouseholdTransactionRequest['icon']>('receipt');
  const [color, setColor] = useState(COLOR_OPTIONS[0]!);
  const [amount, setAmount] = useState('');
  const [userId, setUserId] = useState(currentUser.data?.user?.id ?? members[0]?.id ?? '');
  const [recurring, setRecurring] = useState(false);
  const [expiresOn, setExpiresOn] = useState('');

  useEffect(() => {
    const currentUserId = currentUser.data?.user?.id;
    if (currentUserId && members.some((member) => member.id === currentUserId))
      setUserId(currentUserId);
  }, [currentUser.data, members]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: (input: CreateHouseholdTransactionRequest) =>
      createHouseholdTransaction(householdId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      onClose();
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({
      kind,
      date: transactionDate(month),
      source,
      icon,
      color,
      amount,
      userId,
      recurring,
      expiresOn: recurring && expiresOn ? expiresOn : null,
    });
  };

  return (
    <div
      className="transactionModalBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="transactionModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
      >
        <div className="transactionModalHeader">
          <div>
            <p className="transactionModalEyebrow">New entry</p>
            <h2 id="transaction-modal-title">Add transaction</h2>
          </div>
          <button type="button" className="modalCloseButton" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form className="transactionForm" onSubmit={submit}>
          <fieldset className="transactionKind" disabled={mutation.isPending}>
            <legend>Transaction type</legend>
            <label className={kind === 'expense' ? 'isSelected' : undefined}>
              <input
                type="radio"
                name="kind"
                value="expense"
                checked={kind === 'expense'}
                onChange={() => {
                  setKind('expense');
                  if (icon === 'banknote') setIcon('receipt');
                }}
              />
              Expense
            </label>
            <label className={kind === 'income' ? 'isSelected' : undefined}>
              <input
                type="radio"
                name="kind"
                value="income"
                checked={kind === 'income'}
                onChange={() => {
                  setKind('income');
                  if (icon === 'receipt') setIcon('banknote');
                }}
              />
              Income
            </label>
          </fieldset>

          <div className="transactionFormGrid">
            <fieldset className="iconPicker" disabled={mutation.isPending}>
              <legend>Icon</legend>
              <div className="iconPickerGrid">
                {Constants.FINANCIAL_ICONS.map((option) => {
                  const label = financialIconLabel(option);
                  return (
                    <label
                      key={option}
                      className={icon === option ? 'isSelected' : undefined}
                      title={label}
                    >
                      <input
                        type="radio"
                        name="icon"
                        value={option}
                        checked={icon === option}
                        onChange={() => setIcon(option)}
                      />
                      <FinancialIcon name={option} size={21} />
                      <span className="srOnly">{label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className="transactionField transactionMemberField">
              <span>Household member</span>
              <select
                value={userId}
                required
                disabled={mutation.isPending}
                onChange={(event) => setUserId(event.target.value)}
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                    {member.id === currentUser.data?.user?.id ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="transactionField transactionSourceField">
              <span>Source</span>
              <input
                value={source}
                list={sourceListId}
                maxLength={Constants.DISPLAY_NAME_MAX_LENGTH}
                placeholder={kind === 'income' ? 'e.g. Salary' : 'e.g. Grocery store'}
                autoFocus
                required
                disabled={mutation.isPending}
                onChange={(event) => setSource(event.target.value)}
              />
              <datalist id={sourceListId}>
                {sources.map((option) => (
                  <option key={option.id} value={option.displayName} />
                ))}
              </datalist>
            </label>

            <label className="transactionField transactionAmountField">
              <span>Amount</span>
              <input
                value={amount}
                type="text"
                inputMode="decimal"
                pattern="\d{1,12}([.,]\d{1,2})?"
                placeholder="0.00"
                required
                disabled={mutation.isPending}
                onChange={(event) => setAmount(event.target.value.replace(',', '.'))}
              />
            </label>
          </div>

          <fieldset className="colorPicker" disabled={mutation.isPending}>
            <legend>Color</legend>
            <div className="colorOptions">
              {COLOR_OPTIONS.map((option) => (
                <label key={option} style={{ backgroundColor: option }}>
                  <input
                    type="radio"
                    name="color"
                    value={option}
                    checked={color === option}
                    onChange={() => setColor(option)}
                  />
                  <span className="srOnly">{option}</span>
                </label>
              ))}
              <label className="customColor" title="Custom color">
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
                <span aria-hidden="true">+</span>
                <span className="srOnly">Custom color</span>
              </label>
            </div>
          </fieldset>

          <div className="recurringSection">
            <label className="toggleRow">
              <span>
                <strong>Recurring transaction</strong>
                <small>Repeat this entry each month</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={recurring}
                disabled={mutation.isPending}
                onChange={(event) => setRecurring(event.target.checked)}
              />
            </label>
            {recurring ? (
              <label className="transactionField expirationField">
                <span>
                  Expiration date <small>Optional</small>
                </span>
                <input
                  type="date"
                  value={expiresOn}
                  min={transactionDate(month)}
                  disabled={mutation.isPending}
                  onChange={(event) => setExpiresOn(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          {mutation.isError ? (
            <Alert variant="error">
              {isApiClientError(mutation.error)
                ? mutation.error.message
                : 'We could not save this transaction.'}
            </Alert>
          ) : null}

          <div className="transactionFormActions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !userId}>
              {mutation.isPending ? 'Adding…' : 'Add transaction'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

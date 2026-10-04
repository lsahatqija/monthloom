'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Constants,
  type CreateHouseholdTransactionRequest,
  type HouseholdMonthResponse,
  type HouseholdTransaction,
  type TransactionSeriesSelection,
} from '@template/contracts';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { Alert, Button } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';
import { useCurrentUser } from '../auth/use-current-user';

import { createHouseholdTransaction, financeKeys, updateHouseholdTransaction } from './finance.api';
import { FinancialIcon, financialIconLabel } from './financial-icon';

const COLOR_OPTIONS = [
  '#35675B',
  '#33805C',
  '#2F7D78',
  '#2F6F9F',
  '#45658B',
  '#67558A',
  '#8B5FA8',
  '#B35C7A',
  '#C4473A',
  '#D4683A',
  '#C48A2C',
  '#6B7280',
];

function todayDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
}

interface TransactionFormProps {
  householdId: string;
  members: HouseholdMonthResponse['members'];
  sources: HouseholdMonthResponse['sources'];
  transaction?: HouseholdTransaction;
  onClose: () => void;
}

export function TransactionForm({
  householdId,
  members,
  sources,
  transaction,
  onClose,
}: TransactionFormProps) {
  const sourceListId = useId();
  const iconPickerRef = useRef<HTMLDetailsElement>(null);
  const colorPickerRef = useRef<HTMLDetailsElement>(null);
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CreateHouseholdTransactionRequest['kind']>(
    transaction?.kind ?? 'expense',
  );
  const [type, setType] = useState<NonNullable<CreateHouseholdTransactionRequest['type']>>(
    transaction?.type ?? 'other',
  );
  const [source, setSource] = useState(transaction?.source.displayName ?? '');
  const [icon, setIcon] = useState<CreateHouseholdTransactionRequest['icon']>(
    transaction?.icon ?? 'receipt',
  );
  const [color, setColor] = useState(transaction?.color ?? COLOR_OPTIONS[0]!);
  const [amount, setAmount] = useState(transaction?.amount ?? '');
  const [date, setDate] = useState(transaction?.date ?? todayDate);
  const [userId, setUserId] = useState(
    transaction?.user.id ?? currentUser.data?.user?.id ?? members[0]?.id ?? '',
  );
  const [recurring, setRecurring] = useState(transaction?.recurring ?? false);
  const [expiresOn, setExpiresOn] = useState(transaction?.expiresOn ?? '');
  const [selection, setSelection] = useState<TransactionSeriesSelection>({
    past: false,
    current: true,
    future: false,
  });

  useEffect(() => {
    const currentUserId = currentUser.data?.user?.id;
    if (!transaction && currentUserId && members.some((member) => member.id === currentUserId))
      setUserId(currentUserId);
  }, [currentUser.data, members, transaction]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (iconPickerRef.current?.open || colorPickerRef.current?.open) {
        if (iconPickerRef.current) iconPickerRef.current.open = false;
        if (colorPickerRef.current) colorPickerRef.current.open = false;
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const iconPicker = iconPickerRef.current;
      const colorPicker = colorPickerRef.current;
      if (iconPicker?.open && !iconPicker.contains(target)) iconPicker.open = false;
      if (colorPicker?.open && !colorPicker.contains(target)) colorPicker.open = false;
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const mutation = useMutation({
    mutationFn: (input: CreateHouseholdTransactionRequest) =>
      transaction
        ? updateHouseholdTransaction(householdId, transaction.id, { transaction: input, selection })
        : createHouseholdTransaction(householdId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      onClose();
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({
      kind,
      type: kind === 'expense' ? type : null,
      date: date || todayDate(),
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
            <p className="transactionModalEyebrow">{transaction ? 'Update entry' : 'New entry'}</p>
            <h2 id="transaction-modal-title">
              {transaction ? 'Edit transaction' : 'Add transaction'}
            </h2>
          </div>

          <button type="button" className="modalCloseButton" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form className="transactionForm" onSubmit={submit}>
          <fieldset className="transactionKind" disabled={mutation.isPending}>
            <legend>Transaction kind</legend>
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
            <div className="transactionCompactRow">
              <div className="iconPicker">
                <span className="iconPickerLabel">Icon</span>
                <details
                  ref={iconPickerRef}
                  className="iconPickerDropdown"
                  aria-disabled={mutation.isPending}
                >
                  <summary
                    onClick={(event) => {
                      if (mutation.isPending) event.preventDefault();
                    }}
                  >
                    <span className="selectedIconPreview" style={{ backgroundColor: color }}>
                      <FinancialIcon name={icon} size={20} />
                    </span>
                    <span>{financialIconLabel(icon)}</span>
                  </summary>
                  <div className="iconPickerPopover">
                    <div className="iconPickerGrid" role="group" aria-label="Choose an icon">
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
                              disabled={mutation.isPending}
                              onChange={() => {
                                setIcon(option);
                                if (iconPickerRef.current) iconPickerRef.current.open = false;
                              }}
                            />
                            <FinancialIcon name={option} size={21} />
                            <span className="srOnly">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </details>
              </div>

              <div className="colorPicker">
                <span className="compactControlLabel">Color</span>
                <details
                  ref={colorPickerRef}
                  className="colorPickerDropdown"
                  aria-disabled={mutation.isPending}
                >
                  <summary
                    onClick={(event) => {
                      if (mutation.isPending) event.preventDefault();
                    }}
                  >
                    <span className="selectedColorPreview" style={{ backgroundColor: color }} />
                    <span>{color.toUpperCase()}</span>
                  </summary>
                  <div className="colorPickerPopover">
                    <div className="colorOptions">
                      {COLOR_OPTIONS.map((option) => (
                        <label key={option} style={{ backgroundColor: option }}>
                          <input
                            type="radio"
                            name="color"
                            value={option}
                            checked={color === option}
                            disabled={mutation.isPending}
                            onChange={() => {
                              setColor(option);
                              if (colorPickerRef.current) colorPickerRef.current.open = false;
                            }}
                          />
                          <span className="srOnly">{option}</span>
                        </label>
                      ))}
                      <label className="customColor" title="Custom color">
                        <input
                          type="color"
                          value={color}
                          disabled={mutation.isPending}
                          onChange={(event) => {
                            setColor(event.target.value);
                            if (colorPickerRef.current) colorPickerRef.current.open = false;
                          }}
                        />
                        <span aria-hidden="true">+</span>
                        <span className="srOnly">Custom color</span>
                      </label>
                    </div>
                  </div>
                </details>
              </div>

              <label className="transactionField transactionMemberField">
                <span>User</span>
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
            </div>
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

            <label className="transactionField transactionTypeField">
              <span>Type</span>
              <select
                value={kind === 'expense' ? type : 'income'}
                required
                disabled={mutation.isPending || kind === 'income'}
                onChange={(event) =>
                  setType(
                    event.target.value as NonNullable<CreateHouseholdTransactionRequest['type']>,
                  )
                }
              >
                {kind === 'income' ? <option value="income">Income</option> : null}
                {kind === 'expense'
                  ? Constants.EXPENSE_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option
                          .split('-')
                          .map((word) => word[0]!.toUpperCase() + word.slice(1))
                          .join(' ')}
                      </option>
                    ))
                  : null}
              </select>
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

            <label className="transactionField transactionDateField">
              <span>
                Date <small>Optional</small>
              </span>
              <input
                type="date"
                value={date}
                disabled={mutation.isPending}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          </div>

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
                onChange={(event) => {
                  const isRecurring = event.target.checked;
                  setRecurring(isRecurring);
                  if (!isRecurring) {
                    setSelection((current) => ({ ...current, future: false }));
                  }
                }}
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
                  min={date || todayDate()}
                  disabled={mutation.isPending}
                  onChange={(event) => setExpiresOn(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          {transaction?.recurring ? (
            <fieldset
              className="transactionScope transactionScopeToggles"
              disabled={mutation.isPending}
            >
              <legend>Apply these changes to</legend>
              <label className={selection.past ? 'isSelected' : undefined}>
                <input
                  type="checkbox"
                  checked={selection.past}
                  onChange={(event) =>
                    setSelection((current) => ({ ...current, past: event.target.checked }))
                  }
                />
                Past
              </label>
              <label className={selection.current ? 'isSelected' : undefined}>
                <input
                  type="checkbox"
                  checked={selection.current}
                  onChange={(event) =>
                    setSelection((current) => ({ ...current, current: event.target.checked }))
                  }
                />
                This transaction
              </label>
              <label
                className={selection.future ? 'isSelected' : undefined}
                aria-disabled={!recurring}
              >
                <input
                  type="checkbox"
                  checked={selection.future}
                  disabled={!recurring || mutation.isPending}
                  onChange={(event) =>
                    setSelection((current) => ({ ...current, future: event.target.checked }))
                  }
                />
                Future
              </label>
            </fieldset>
          ) : null}

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
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                !userId ||
                Boolean(
                  transaction?.recurring &&
                  !selection.past &&
                  !selection.current &&
                  !selection.future,
                )
              }
            >
              {mutation.isPending
                ? transaction
                  ? 'Saving…'
                  : 'Adding…'
                : transaction
                  ? 'Save changes'
                  : 'Add transaction'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

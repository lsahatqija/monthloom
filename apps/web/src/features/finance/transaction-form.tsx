'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Constants,
  createHouseholdTransactionRequestSchema,
  type CreateHouseholdTransactionRequest,
  type HouseholdMonthResponse,
  type HouseholdTransaction,
  type TransactionSeriesSelection,
} from '@monthloom/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, Button } from '../../components/ui/index';
import { useCurrentUser } from '../auth/use-current-user';

import { financeErrorMessage } from './api/errors';
import { createHouseholdTransaction, financeKeys, updateHouseholdTransaction } from './finance.api';
import { FinancialIcon, financialIconLabel } from './financial-icon';
import { SourceModal } from './source-modal';
import { transactionTypeLabel } from './transaction-type';

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
  transactions?: HouseholdMonthResponse['transactions'];
  transaction?: HouseholdTransaction;
  onClose: () => void;
}

export function TransactionForm({
  householdId,
  members,
  sources,
  transactions = [],
  transaction,
  onClose,
}: TransactionFormProps) {
  const iconPickerRef = useRef<HTMLDetailsElement>(null);
  const colorPickerRef = useRef<HTMLDetailsElement>(null);
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const [availableSources, setAvailableSources] = useState(sources);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [expires, setExpires] = useState(Boolean(transaction?.expiresOn));
  const [selection, setSelection] = useState<TransactionSeriesSelection>({
    past: false,
    current: true,
    future: false,
  });
  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateHouseholdTransactionRequest>({
    resolver: zodResolver(createHouseholdTransactionRequestSchema),
    defaultValues: {
      kind: transaction?.kind ?? 'expense',
      type: transaction?.type ?? 'other',
      sourceId: transaction?.source.id ?? '',
      icon: transaction?.icon ?? 'receipt',
      color: transaction?.color ?? COLOR_OPTIONS[0]!,
      amount: transaction?.amount ?? '',
      date: transaction?.date ?? todayDate(),
      userId: transaction?.user.id ?? currentUser.data?.user?.id ?? members[0]?.id ?? '',
      recurring: transaction?.recurring ?? false,
      expiresOn: transaction?.expiresOn ?? null,
    },
  });
  const kind = watch('kind');
  const type = watch('type') ?? 'other';
  const sourceId = watch('sourceId');
  const icon = watch('icon');
  const color = watch('color');
  const amount = watch('amount');
  const date = watch('date');
  const userId = watch('userId');
  const recurring = watch('recurring');
  const expiresOn = watch('expiresOn') ?? '';

  const selectSource = (selectedSourceId: string) => {
    setValue('sourceId', selectedSourceId);
    if (transaction) return;

    const mostRecentTransaction = transactions
      .filter((entry) => !entry.projected && entry.source.id === selectedSourceId)
      .sort(
        (left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id),
      )[0];
    if (!mostRecentTransaction) return;

    setValue('kind', mostRecentTransaction.kind);
    setValue('type', mostRecentTransaction.type);
    setValue('icon', mostRecentTransaction.icon);
    setValue('color', mostRecentTransaction.color);
  };

  useEffect(() => {
    const currentUserId = currentUser.data?.user?.id;
    if (!transaction && currentUserId && members.some((member) => member.id === currentUserId))
      setValue('userId', currentUserId);
  }, [currentUser.data, members, setValue, transaction]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (iconPickerRef.current?.open || colorPickerRef.current?.open) {
        if (iconPickerRef.current) iconPickerRef.current.open = false;
        if (colorPickerRef.current) colorPickerRef.current.open = false;
        return;
      }
      if (isAddingSource) {
        setIsAddingSource(false);
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddingSource, onClose]);

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

  const submit = handleSubmit((input) =>
    mutation.mutate({
      ...input,
      type: input.kind === 'expense' ? input.type : null,
      date: input.date || todayDate(),
      expiresOn: input.recurring && expires && input.expiresOn ? input.expiresOn : null,
    }),
  );

  if (isAddingSource) {
    return (
      <SourceModal
        householdId={householdId}
        onClose={() => setIsAddingSource(false)}
        onSaved={(source) => {
          setAvailableSources((current) =>
            [...current, source].sort(
              (left, right) =>
                left.displayName.localeCompare(right.displayName) ||
                left.id.localeCompare(right.id),
            ),
          );
          setValue('sourceId', source.id);
          setIsAddingSource(false);
        }}
      />
    );
  }

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

          <button
            type="button"
            className="modalCloseButton"
            data-onboarding="transaction-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form className="transactionForm" onSubmit={submit}>
          <fieldset
            className="transactionKind"
            data-onboarding="transaction-kind"
            disabled={mutation.isPending}
          >
            <legend>Transaction kind</legend>
            <label className={kind === 'expense' ? 'isSelected' : undefined}>
              <input
                type="radio"
                name="kind"
                value="expense"
                checked={kind === 'expense'}
                onChange={() => {
                  setValue('kind', 'expense');
                  if (!type) setValue('type', 'other');
                  if (icon === 'banknote') setValue('icon', 'receipt');
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
                  setValue('kind', 'income');
                  setValue('type', null);
                  if (icon === 'receipt') setValue('icon', 'banknote');
                }}
              />
              Income
            </label>
          </fieldset>

          <div className="transactionFormGrid" data-onboarding="transaction-fields">
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
                                setValue('icon', option);
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
                              setValue('color', option);
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
                            setValue('color', event.target.value);
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
                  onChange={(event) => setValue('userId', event.target.value)}
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
            <label
              className="transactionField transactionSourceField"
              data-onboarding="transaction-source"
            >
              <span>Source</span>
              <select
                value={sourceId}
                autoFocus
                required
                disabled={mutation.isPending}
                onChange={(event) => {
                  if (event.target.value === 'add-new-source') {
                    setIsAddingSource(true);
                    window.dispatchEvent(
                      new CustomEvent('monthloom:onboarding', { detail: 'add-source' }),
                    );
                    return;
                  }
                  selectSource(event.target.value);
                }}
              >
                <option value="add-new-source">Add new source</option>
                <option value="" disabled>
                  Select a source
                </option>
                {availableSources.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="transactionField transactionTypeField">
              <span>Type</span>
              <select
                value={kind === 'expense' ? type : 'income'}
                required
                disabled={mutation.isPending || kind === 'income'}
                onChange={(event) =>
                  setValue(
                    'type',
                    event.target.value as NonNullable<CreateHouseholdTransactionRequest['type']>,
                  )
                }
              >
                {kind === 'income' ? <option value="income">Income</option> : null}
                {kind === 'expense'
                  ? Constants.EXPENSE_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {transactionTypeLabel(option)}
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
                onChange={(event) => setValue('amount', event.target.value.replace(',', '.'))}
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
                onChange={(event) => setValue('date', event.target.value)}
              />
            </label>
          </div>

          <div className="recurringSection" data-onboarding="recurring">
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
                  setValue('recurring', isRecurring);
                  if (isRecurring) {
                    window.dispatchEvent(
                      new CustomEvent('monthloom:onboarding', { detail: 'recurring-enabled' }),
                    );
                  }
                  if (!isRecurring) {
                    setSelection((current) => ({ ...current, future: false }));
                  }
                }}
              />
            </label>
            {recurring ? (
              <div className="expirationControls" data-onboarding="expiration">
                <label className="toggleRow">
                  <span>
                    <strong>Expires</strong>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={expires}
                    disabled={mutation.isPending}
                    onChange={(event) => setExpires(event.target.checked)}
                  />
                </label>
                {expires ? (
                  <label className="transactionField expirationField">
                    <span>Expiration date</span>
                    <input
                      type="date"
                      required
                      value={expiresOn}
                      min={date || todayDate()}
                      disabled={mutation.isPending}
                      onChange={(event) => setValue('expiresOn', event.target.value)}
                    />
                  </label>
                ) : null}
              </div>
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

          {Object.keys(errors).length ? (
            <Alert variant="error">Check the highlighted transaction fields and try again.</Alert>
          ) : null}

          {mutation.isError ? (
            <Alert variant="error">
              {financeErrorMessage(mutation.error, 'We could not save this transaction.')}
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
                !sourceId ||
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

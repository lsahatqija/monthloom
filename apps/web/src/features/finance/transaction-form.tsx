'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Constants,
  Defaults,
  createHouseholdTransactionRequestSchema,
  type CreateHouseholdTransactionRequest,
  type HouseholdMonthResponse,
  type HouseholdTransaction,
  type TransactionSeriesSelection,
} from '@monthloom/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';

import { Alert, Button } from '../../components/ui/index';
import { useCurrentUser } from '../auth/use-current-user';

import { financeErrorMessage } from './api/errors';
import { createHouseholdTransaction, financeKeys, updateHouseholdTransaction } from './finance.api';
import { FinancialIcon, financialIconLabel } from './financial-icon';
import { SourceModal } from './source-modal';
import { transactionTypeLabel } from './transaction-type';

const COLOR_OPTIONS = [
  Defaults.TRANSACTION_COLOR,
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

interface RecurrenceWheelProps<T extends string | number> {
  label: string;
  options: readonly T[];
  value: T;
  disabled: boolean;
  format: (option: T) => string;
  onChange: (option: T) => void;
  freeMoving?: boolean;
}

function RecurrenceWheel<T extends string | number>({
  label,
  options,
  value,
  disabled,
  format,
  onChange,
  freeMoving = false,
}: RecurrenceWheelProps<T>) {
  const drag = useRef<{ y: number; time: number; velocity: number; offset: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const currentIndex = Math.max(0, options.indexOf(value));
  const itemHeight = 28;

  const settle = (steps: number, restingOffset = 0) => {
    const targetIndex = Math.min(options.length - 1, Math.max(0, currentIndex + steps));
    const actualSteps = targetIndex - currentIndex;
    if (actualSteps) onChange(options[targetIndex]!);
    setDragging(false);
    setOffset(
      Math.max(-itemHeight * 3, Math.min(itemHeight * 3, restingOffset + actualSteps * itemHeight)),
    );
    requestAnimationFrame(() => requestAnimationFrame(() => setOffset(0)));
  };

  const move = (direction: -1 | 1) => {
    settle(direction);
  };

  const visibleOptions = Array.from({ length: 7 }, (_, index) => {
    const optionIndex = currentIndex + index - 3;
    return optionIndex >= 0 && optionIndex < options.length
      ? { option: options[optionIndex]!, relativeIndex: index - 3 }
      : null;
  });

  return (
    <div className="recurrenceWheelControl">
      <div
        className="recurrenceWindow"
        role="group"
        aria-label={`${label}: ${format(value)}`}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            move(-1);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            move(1);
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          move(event.deltaY < 0 ? -1 : 1);
        }}
        onPointerDown={(event) => {
          if (disabled) return;
          drag.current = { y: event.clientY, time: performance.now(), velocity: 0, offset: 0 };
          setDragging(true);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const now = performance.now();
          const distance = event.clientY - drag.current.y;
          const elapsed = Math.max(1, now - drag.current.time);
          const nextOffset = freeMoving
            ? drag.current.offset + distance
            : Math.max(-itemHeight, Math.min(itemHeight, drag.current.offset + distance));
          drag.current = {
            y: event.clientY,
            time: now,
            velocity: distance / elapsed,
            offset: nextOffset,
          };
          setOffset(nextOffset);
        }}
        onPointerUp={(event) => {
          if (!drag.current) return;
          const { offset: releaseOffset, velocity } = drag.current;
          drag.current = null;
          const projectedOffset = releaseOffset + (freeMoving ? velocity * 140 : 0);
          const steps = freeMoving
            ? Math.round(-projectedOffset / itemHeight)
            : Math.abs(releaseOffset) >= 12
              ? releaseOffset > 0
                ? -1
                : 1
              : 0;
          settle(steps, releaseOffset);
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          setOffset(0);
        }}
      >
        <div className={`recurrenceWindowTrack${dragging ? ' isDragging' : ''}`}>
          {visibleOptions.map((item, index) =>
            item ? (
              <span
                key={item.option}
                className={item.relativeIndex === 0 ? 'isCurrent' : undefined}
                style={{
                  transform: `translateY(calc(-50% + ${item.relativeIndex * itemHeight + offset}px))`,
                }}
                aria-hidden={item.relativeIndex !== 0}
                aria-live={item.relativeIndex === 0 ? 'polite' : undefined}
              >
                {format(item.option)}
              </span>
            ) : (
              <span key={`empty-${index}`} aria-hidden="true" />
            ),
          )}
        </div>
      </div>
      <div className="recurrenceWheelButtons">
        <button
          type="button"
          aria-label={`Previous ${label.toLowerCase()}`}
          disabled={disabled || currentIndex === 0}
          onClick={() => move(-1)}
        >
          <ChevronUp aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Next ${label.toLowerCase()}`}
          disabled={disabled || currentIndex === options.length - 1}
          onClick={() => move(1)}
        >
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function usePickerPosition(
  open: boolean,
  pickerRef: React.RefObject<HTMLDetailsElement>,
  popoverRef: React.RefObject<HTMLDivElement>,
  align: 'left' | 'center',
) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;

    const positionPopover = () => {
      const trigger = pickerRef.current?.querySelector('summary');
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const triggerRect = trigger.getBoundingClientRect();
      const gap = 7;
      const viewportMargin = 8;
      const topBelow = triggerRect.bottom + gap;
      const top =
        topBelow + popover.offsetHeight <= window.innerHeight - viewportMargin
          ? topBelow
          : Math.max(viewportMargin, triggerRect.top - popover.offsetHeight - gap);
      const desiredLeft =
        align === 'center'
          ? triggerRect.left + (triggerRect.width - popover.offsetWidth) / 2
          : triggerRect.left;
      const left = Math.min(
        Math.max(viewportMargin, desiredLeft),
        window.innerWidth - popover.offsetWidth - viewportMargin,
      );

      setPosition({ top, left });
    };

    positionPopover();
    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);
    return () => {
      window.removeEventListener('resize', positionPopover);
      window.removeEventListener('scroll', positionPopover, true);
    };
  }, [align, open, pickerRef, popoverRef]);

  return position;
}

function todayDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
}

function editableTransactionType(
  transaction: HouseholdTransaction | undefined,
): CreateHouseholdTransactionRequest['type'] {
  if (!transaction) return Defaults.TRANSACTION_TYPE;
  if (transaction.kind === 'income') return Defaults.INCOME_TRANSACTION_TYPE;

  // `gadgets` was renamed to `technology`. The database migration updates persisted rows, but
  // clients can still hold the old representation in an already-loaded monthly view.
  if ((transaction.type as string | null) === 'gadgets') return 'technology';
  return transaction.type ?? Defaults.TRANSACTION_TYPE;
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
  const iconPickerPopoverRef = useRef<HTMLDivElement>(null);
  const colorPickerPopoverRef = useRef<HTMLDivElement>(null);
  const sourcePickerRef = useRef<HTMLDivElement>(null);
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const [availableSources, setAvailableSources] = useState(sources);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [sourceQuery, setSourceQuery] = useState(transaction?.source.displayName ?? '');
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
      kind: transaction?.kind ?? Defaults.TRANSACTION_KIND,
      type: transaction ? editableTransactionType(transaction) : Defaults.TRANSACTION_TYPE,
      sourceId: transaction?.source.id ?? '',
      icon: transaction?.icon ?? Defaults.TRANSACTION_ICON,
      color: transaction?.color ?? Defaults.TRANSACTION_COLOR,
      amount: transaction?.amount ?? '',
      date: transaction?.date ?? todayDate(),
      userId: transaction?.user.id ?? currentUser.data?.user?.id ?? members[0]?.id ?? '',
      recurring: transaction?.recurring ?? Defaults.TRANSACTION_RECURRING,
      recurrenceInterval:
        transaction?.recurrenceInterval ?? Defaults.TRANSACTION_RECURRENCE_INTERVAL,
      recurrenceUnit: transaction?.recurrenceUnit ?? Defaults.TRANSACTION_RECURRENCE_UNIT,
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
  const recurrenceInterval = watch('recurrenceInterval');
  const recurrenceUnit = watch('recurrenceUnit');
  const expiresOn = watch('expiresOn') ?? '';

  const selectSource = (selectedSourceId: string) => {
    setValue('sourceId', selectedSourceId, { shouldValidate: true });
    if (transaction) return;

    const mostRecentTransaction = transactions
      .filter((entry) => !entry.projected && entry.source.id === selectedSourceId)
      .sort(
        (left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id),
      )[0];
    if (!mostRecentTransaction) return;

    setValue('kind', mostRecentTransaction.kind);
    setValue('type', editableTransactionType(mostRecentTransaction));
    setValue('icon', mostRecentTransaction.icon);
    setValue('color', mostRecentTransaction.color);
  };
  const iconPickerPosition = usePickerPosition(
    iconPickerOpen,
    iconPickerRef,
    iconPickerPopoverRef,
    'left',
  );
  const colorPickerPosition = usePickerPosition(
    colorPickerOpen,
    colorPickerRef,
    colorPickerPopoverRef,
    'center',
  );
  const filteredSources = useMemo(() => {
    const query = sourceQuery.trim().toLocaleLowerCase();
    if (!query) return availableSources;

    return availableSources.filter(
      (source) =>
        source.displayName.toLocaleLowerCase().includes(query) ||
        source.aliases.some((alias) => alias.toLocaleLowerCase().includes(query)),
    );
  }, [availableSources, sourceQuery]);

  useEffect(() => {
    const currentUserId = currentUser.data?.user?.id;
    if (!transaction && currentUserId && members.some((member) => member.id === currentUserId))
      setValue('userId', currentUserId);
  }, [currentUser.data, members, setValue, transaction]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (iconPickerOpen || colorPickerOpen || sourcePickerOpen) {
        setIconPickerOpen(false);
        setColorPickerOpen(false);
        setSourcePickerOpen(false);
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
  }, [colorPickerOpen, iconPickerOpen, isAddingSource, onClose, sourcePickerOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const iconPicker = iconPickerRef.current;
      const colorPicker = colorPickerRef.current;
      if (
        iconPickerOpen &&
        !iconPicker?.contains(target) &&
        !iconPickerPopoverRef.current?.contains(target)
      )
        setIconPickerOpen(false);
      if (
        colorPickerOpen &&
        !colorPicker?.contains(target) &&
        !colorPickerPopoverRef.current?.contains(target)
      )
        setColorPickerOpen(false);
      if (sourcePickerOpen && !sourcePickerRef.current?.contains(target)) {
        setSourcePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [colorPickerOpen, iconPickerOpen, sourcePickerOpen]);

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

  const validationMessage = Object.values(errors)
    .map((error) => error?.message)
    .find((message): message is string => typeof message === 'string');

  const submit = handleSubmit((input) =>
    mutation.mutate({
      ...input,
      type: input.type,
      date: input.date || todayDate(),
      expiresOn: input.recurring && expires && input.expiresOn ? input.expiresOn : null,
    }),
  );

  if (isAddingSource) {
    return (
      <SourceModal
        householdId={householdId}
        initialDisplayName={sourceQuery}
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
          setSourceQuery(source.displayName);
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

        <form className="transactionForm" onSubmit={submit} noValidate>
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
                  if (!type) setValue('type', Defaults.TRANSACTION_TYPE);
                  if (icon === Defaults.INCOME_TRANSACTION_ICON) {
                    setValue('icon', Defaults.TRANSACTION_ICON);
                  }
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
                  setValue('type', Defaults.INCOME_TRANSACTION_TYPE);
                  if (icon === Defaults.TRANSACTION_ICON) {
                    setValue('icon', Defaults.INCOME_TRANSACTION_ICON);
                  }
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
                  open={iconPickerOpen}
                  onToggle={(event) => setIconPickerOpen(event.currentTarget.open)}
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
                </details>
                {iconPickerOpen && typeof document !== 'undefined'
                  ? createPortal(
                      <div
                        ref={iconPickerPopoverRef}
                        className="iconPickerPopover isPortaled"
                        style={iconPickerPosition}
                      >
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
                                    setIconPickerOpen(false);
                                  }}
                                />
                                <FinancialIcon name={option} size={21} />
                                <span className="srOnly">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>,
                      document.body,
                    )
                  : null}
              </div>

              <div className="colorPicker">
                <span className="compactControlLabel">Color</span>
                <details
                  ref={colorPickerRef}
                  className="colorPickerDropdown"
                  aria-disabled={mutation.isPending}
                  open={colorPickerOpen}
                  onToggle={(event) => setColorPickerOpen(event.currentTarget.open)}
                >
                  <summary
                    onClick={(event) => {
                      if (mutation.isPending) event.preventDefault();
                    }}
                  >
                    <span className="selectedColorPreview" style={{ backgroundColor: color }} />
                    <span>{color.toUpperCase()}</span>
                  </summary>
                </details>
                {colorPickerOpen && typeof document !== 'undefined'
                  ? createPortal(
                      <div
                        ref={colorPickerPopoverRef}
                        className="colorPickerPopover isPortaled"
                        style={colorPickerPosition}
                      >
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
                                  setColorPickerOpen(false);
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
                                setColorPickerOpen(false);
                              }}
                            />
                            <span aria-hidden="true">+</span>
                            <span className="srOnly">Custom color</span>
                          </label>
                        </div>
                      </div>,
                      document.body,
                    )
                  : null}
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
            <div
              ref={sourcePickerRef}
              className="transactionField transactionSourceField"
              data-onboarding="transaction-source"
            >
              <label htmlFor="transaction-source">Source</label>
              <input
                id="transaction-source"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="transaction-source-options"
                aria-expanded={sourcePickerOpen}
                aria-haspopup="listbox"
                value={sourceQuery}
                autoFocus
                required
                disabled={mutation.isPending}
                placeholder="Search sources"
                onClick={() => setSourcePickerOpen(true)}
                onChange={(event) => {
                  setSourceQuery(event.target.value);
                  setValue('sourceId', '');
                  setSourcePickerOpen(true);
                }}
              />
              {sourcePickerOpen ? (
                <div
                  id="transaction-source-options"
                  className="transactionSourceOptions"
                  role="listbox"
                  aria-label="Sources"
                >
                  <div className="transactionSourceMatches">
                    {filteredSources.length ? (
                      filteredSources.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="option"
                          aria-selected={sourceId === option.id}
                          className={sourceId === option.id ? 'isSelected' : undefined}
                          onClick={() => {
                            selectSource(option.id);
                            setSourceQuery(option.displayName);
                            setSourcePickerOpen(false);
                          }}
                        >
                          {option.displayName}
                        </button>
                      ))
                    ) : (
                      <p className="transactionSourceEmpty">No matching sources</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="transactionAddSource"
                    onClick={() => {
                      setSourcePickerOpen(false);
                      setIsAddingSource(true);
                      window.dispatchEvent(
                        new CustomEvent('monthloom:onboarding', { detail: 'add-source' }),
                      );
                    }}
                  >
                    <span aria-hidden="true">+</span>
                    Add new source
                  </button>
                </div>
              ) : null}
            </div>

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

            <div className="transactionAmountDateRow">
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
          </div>

          <div className="recurringSection" data-onboarding="recurring">
            <label className="toggleRow">
              <span>
                <strong>Recurring transaction</strong>
                <small>Repeat this entry on a schedule</small>
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
              <>
                <fieldset className="recurrenceControls">
                  <legend>Repeat every</legend>
                  <RecurrenceWheel
                    label="Recurrence interval"
                    options={Array.from(
                      { length: Constants.RECURRENCE_INTERVAL_MAX },
                      (_, index) => index + 1,
                    )}
                    value={recurrenceInterval}
                    disabled={mutation.isPending}
                    freeMoving
                    format={String}
                    onChange={(option) =>
                      setValue('recurrenceInterval', option, { shouldValidate: true })
                    }
                  />
                  <RecurrenceWheel
                    label="Recurrence unit"
                    options={Constants.RECURRENCE_UNITS}
                    value={recurrenceUnit}
                    disabled={mutation.isPending}
                    format={(option) => `${option}${recurrenceInterval === 1 ? '' : 's'}`}
                    onChange={(option) =>
                      setValue('recurrenceUnit', option, { shouldValidate: true })
                    }
                  />
                  <p aria-live="polite">
                    Every {recurrenceInterval} {recurrenceUnit}
                    {recurrenceInterval === 1 ? '' : 's'}
                  </p>
                </fieldset>
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
                      onChange={(event) => {
                        const isExpiring = event.target.checked;
                        setExpires(isExpiring);
                        if (!isExpiring) {
                          setValue('expiresOn', null, { shouldValidate: true });
                        }
                      }}
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
              </>
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
            <Alert variant="error">
              {validationMessage ?? 'Check the transaction fields and try again.'}
            </Alert>
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

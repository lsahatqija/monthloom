'use client';

import { CalendarCheck, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  calendarMonth,
  clampCalendarMonth,
  formatTranslatedMonthYear,
  MONTH_KEYS,
  shiftCalendarMonth,
} from './month';

type MonthLabelVariant = 'full' | 'shortYear' | 'month' | 'abbreviatedShortYear' | 'abbreviated';

export function selectMonthLabelVariant(
  availableWidth: number,
  fullWidth: number,
  shortYearWidth: number,
  monthWidth: number,
  abbreviatedShortYearWidth: number,
): MonthLabelVariant {
  if (fullWidth <= availableWidth) return 'full';
  if (shortYearWidth <= availableWidth) return 'shortYear';
  if (monthWidth <= availableWidth) return 'month';
  if (abbreviatedShortYearWidth <= availableWidth) return 'abbreviatedShortYear';
  return 'abbreviated';
}

export function shouldCollapseCurrentMonthButton(
  availableWidth: number,
  controlsWidth: number,
  abbreviatedLabelWidth: number,
): boolean {
  return controlsWidth + abbreviatedLabelWidth > availableWidth;
}

export function MonthPicker({
  value,
  onChange,
  navigation = true,
  showCurrentMonthAction = navigation,
  minimum,
  maximum,
}: {
  value: string;
  onChange: (month: string) => void;
  navigation?: boolean;
  showCurrentMonthAction?: boolean;
  minimum?: string;
  maximum?: string;
}) {
  const t = useTranslations('Finance');
  const monthLabels = useTranslations('Labels.months');
  const locale = useLocale();
  const popoverId = `month-picker-${useId().replaceAll(':', '')}`;
  const [selectedYear, selectedMonthNumber] = value.split('-').map(Number);
  const current = calendarMonth();
  const selectedMonthDate = new Date(selectedYear!, selectedMonthNumber! - 1, 1);
  const monthName = monthLabels(MONTH_KEYS[selectedMonthNumber! - 1]!);
  const monthYearFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    [locale],
  );
  const abbreviatedMonthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short' }),
    [locale],
  );
  const monthLabel = formatTranslatedMonthYear(monthYearFormatter, selectedMonthDate, monthName);
  const abbreviatedMonthName = abbreviatedMonthFormatter.format(selectedMonthDate);
  const shortYear = `'${String(selectedYear).slice(-2)}`;
  const monthNameWithShortYear = `${monthName} ${shortYear}`;
  const abbreviatedMonthNameWithShortYear = `${abbreviatedMonthName} ${shortYear}`;
  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: monthLabels(MONTH_KEYS[index]!),
        abbreviatedLabel: abbreviatedMonthFormatter.format(new Date(2024, index, 1)),
      })),
    [abbreviatedMonthFormatter, monthLabels],
  );
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const firstYear = minimum ? Number(minimum.slice(0, 4)) : currentYear - 10;
    const lastYear = maximum ? Number(maximum.slice(0, 4)) : currentYear + 10;
    const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
    if (!years.includes(selectedYear!)) years.push(selectedYear!);
    return years.sort((a, b) => a - b);
  }, [maximum, minimum, selectedYear]);
  const [open, setOpen] = useState(false);
  const previousMonthRef = useRef(value);
  const direction =
    value === previousMonthRef.current
      ? 'none'
      : value > previousMonthRef.current
        ? 'forward'
        : 'backward';
  const [labelVariant, setLabelVariant] = useState<MonthLabelVariant>('full');
  const [currentMonthButtonInPicker, setCurrentMonthButtonInPicker] = useState(false);
  const [labelWidth, setLabelWidth] = useState<number>();
  const navigationRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const fullLabelRef = useRef<HTMLSpanElement>(null);
  const shortYearLabelRef = useRef<HTMLSpanElement>(null);
  const monthOnlyLabelRef = useRef<HTMLSpanElement>(null);
  const abbreviatedShortYearLabelRef = useRef<HTMLSpanElement>(null);
  const abbreviatedLabelRef = useRef<HTMLSpanElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    previousMonthRef.current = value;
  }, [value]);

  useLayoutEffect(() => {
    if (!navigation) return;
    const container = navigationRef.current;
    const visibleLabel = labelRef.current;
    const picker = pickerRef.current;
    const trigger = triggerRef.current;
    const fullLabel = fullLabelRef.current;
    const shortYearLabel = shortYearLabelRef.current;
    const monthOnlyLabel = monthOnlyLabelRef.current;
    const abbreviatedShortYearLabel = abbreviatedShortYearLabelRef.current;
    const abbreviatedLabel = abbreviatedLabelRef.current;
    if (
      !container ||
      !visibleLabel ||
      !picker ||
      !trigger ||
      !fullLabel ||
      !shortYearLabel ||
      !monthOnlyLabel ||
      !abbreviatedShortYearLabel ||
      !abbreviatedLabel ||
      typeof ResizeObserver === 'undefined'
    )
      return;

    const measure = () => {
      const fullLabelWidth = fullLabel.getBoundingClientRect().width;
      const shortYearLabelWidth = shortYearLabel.getBoundingClientRect().width;
      const monthNameWidth = monthOnlyLabel.getBoundingClientRect().width;
      const abbreviatedShortYearLabelWidth =
        abbreviatedShortYearLabel.getBoundingClientRect().width;
      const abbreviatedMonthNameWidth = abbreviatedLabel.getBoundingClientRect().width;
      const visibleLabelWidth = visibleLabel.getBoundingClientRect().width;
      const gap = Number.parseFloat(getComputedStyle(container).columnGap) || 0;
      const showCurrentButton = showCurrentMonthAction && value !== current;
      const navigationButtonWidth =
        container.querySelector<HTMLElement>('.monthNavigationButton')?.getBoundingClientRect()
          .width ?? 0;
      const pickerChromeWidth = trigger.getBoundingClientRect().width - visibleLabelWidth;
      const otherControlsWidth = Array.from(container.children).reduce(
        (width, child) =>
          child === picker || child.classList.contains('currentMonthButton')
            ? width
            : width + child.getBoundingClientRect().width,
        0,
      );
      const expandedControlsWidth =
        otherControlsWidth +
        pickerChromeWidth +
        (showCurrentButton ? navigationButtonWidth : 0) +
        gap * (showCurrentButton ? 3 : 2);
      const collapseCurrentButton =
        showCurrentButton &&
        shouldCollapseCurrentMonthButton(
          container.clientWidth,
          expandedControlsWidth,
          abbreviatedMonthNameWidth,
        );
      const controlsWidth = collapseCurrentButton
        ? otherControlsWidth + pickerChromeWidth + gap * 2
        : expandedControlsWidth;
      const variant = selectMonthLabelVariant(
        container.clientWidth - controlsWidth,
        fullLabelWidth,
        shortYearLabelWidth,
        monthNameWidth,
        abbreviatedShortYearLabelWidth,
      );
      setCurrentMonthButtonInPicker(collapseCurrentButton);
      setLabelVariant(variant);
      setLabelWidth(
        variant === 'full'
          ? fullLabelWidth
          : variant === 'shortYear'
            ? shortYearLabelWidth
            : variant === 'month'
              ? monthNameWidth
              : variant === 'abbreviatedShortYear'
                ? abbreviatedShortYearLabelWidth
                : abbreviatedMonthNameWidth,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    measure();
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [current, monthLabel, navigation, showCurrentMonthAction, value]);

  useEffect(() => {
    if (!open) return;
    const closePicker = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closePickerWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', closePicker);
    document.addEventListener('keydown', closePickerWithKeyboard);
    return () => {
      document.removeEventListener('mousedown', closePicker);
      document.removeEventListener('keydown', closePickerWithKeyboard);
    };
  }, [open]);

  const chooseMonth = (month: string) => {
    onChange(clampCalendarMonth(month, minimum, maximum));
    setOpen(false);
  };
  const currentActionInPopover =
    showCurrentMonthAction &&
    current !== value &&
    current >= (minimum ?? current) &&
    current <= (maximum ?? current) &&
    (currentMonthButtonInPicker || !navigation);

  const picker = (
    <div ref={pickerRef} className="monthPicker">
      <div className="monthHeading">
        <button
          ref={triggerRef}
          type="button"
          className="monthPickerTrigger"
          aria-label={t('chooseMonthValue', { month: monthLabel })}
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={() => setOpen((visible) => !visible)}
        >
          <span
            key={value}
            ref={labelRef}
            className="monthLabelText"
            data-direction={direction}
            style={navigation && labelWidth ? { width: `${labelWidth}px` } : undefined}
          >
            {labelVariant === 'full' || !navigation
              ? monthLabel
              : labelVariant === 'shortYear'
                ? monthNameWithShortYear
                : labelVariant === 'month'
                  ? monthName
                  : labelVariant === 'abbreviatedShortYear'
                    ? abbreviatedMonthNameWithShortYear
                    : abbreviatedMonthName}
          </span>
          <span ref={fullLabelRef} className="monthLabelMeasure" aria-hidden="true">
            {monthNames.map((option) => (
              <span key={option.value}>{`${option.label} ${selectedYear}`}</span>
            ))}
          </span>
          <span ref={shortYearLabelRef} className="monthLabelMeasure" aria-hidden="true">
            {monthNames.map((option) => (
              <span key={option.value}>{`${option.label} ${shortYear}`}</span>
            ))}
          </span>
          <span ref={monthOnlyLabelRef} className="monthLabelMeasure" aria-hidden="true">
            {monthNames.map((option) => (
              <span key={option.value}>{option.label}</span>
            ))}
          </span>
          <span ref={abbreviatedShortYearLabelRef} className="monthLabelMeasure" aria-hidden="true">
            {monthNames.map((option) => (
              <span key={option.value}>{`${option.abbreviatedLabel} ${shortYear}`}</span>
            ))}
          </span>
          <span ref={abbreviatedLabelRef} className="monthLabelMeasure" aria-hidden="true">
            {monthNames.map((option) => (
              <span key={option.value}>{option.abbreviatedLabel}</span>
            ))}
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <div
          id={popoverId}
          className="monthPickerPopover"
          role="group"
          aria-label={t('chooseMonth')}
        >
          <label>
            <span>{t('month')}</span>
            <select
              value={selectedMonthNumber}
              onChange={(event) =>
                chooseMonth(`${selectedYear}-${event.target.value.padStart(2, '0')}`)
              }
            >
              {monthNames.map((option) => {
                const optionMonth = `${selectedYear}-${String(option.value).padStart(2, '0')}`;
                return (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={
                      optionMonth < (minimum ?? optionMonth) ||
                      optionMonth > (maximum ?? optionMonth)
                    }
                  >
                    {option.label}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            <span>{t('year')}</span>
            <select
              value={selectedYear}
              onChange={(event) =>
                chooseMonth(`${event.target.value}-${String(selectedMonthNumber).padStart(2, '0')}`)
              }
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          {currentActionInPopover ? (
            <button
              type="button"
              className="monthPickerCurrentMonthButton"
              onClick={() => chooseMonth(current)}
            >
              {t('currentMonth')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (!navigation) return picker;

  return (
    <div
      ref={navigationRef}
      className={`monthNavigation${currentMonthButtonInPicker ? ' isCompact' : ''}`}
      aria-label={t('monthNavigation')}
    >
      <button
        type="button"
        className={`currentMonthButton${value === current ? ' isHidden' : ''}`}
        aria-label={t('currentMonth')}
        aria-hidden={value === current ? 'true' : undefined}
        tabIndex={value === current ? -1 : undefined}
        title={value === current ? undefined : t('currentMonth')}
        onClick={() => onChange(current)}
      >
        <CalendarCheck aria-hidden="true" />
      </button>
      <button
        type="button"
        className="monthNavigationButton"
        aria-label={t('previousMonth')}
        disabled={Boolean(minimum && value <= minimum)}
        onClick={() => onChange(shiftCalendarMonth(value, -1))}
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      {picker}
      <button
        type="button"
        className="monthNavigationButton"
        aria-label={t('nextMonth')}
        disabled={Boolean(maximum && value >= maximum)}
        onClick={() => onChange(shiftCalendarMonth(value, 1))}
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

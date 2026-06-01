import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Repeat2, X } from 'lucide-react';
import { NavigationService } from '../../../_services/navigationService';
import MaskedDateInput, { MaskedDateInputRef } from './MaskedDateInput';
import type { RecurrenceSchedule } from './types';

interface RecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recurrence: RecurrenceSchedule) => void;
  initialStartDate?: string | null;
}

type RepeatMode = 'daily' | 'weekdays' | 'weekly';
type StartDateOption = 'today' | 'tomorrow';

type DateState = {
  valid: boolean;
  parsed: Date | null;
  formatted: string | null;
  relative: string | null;
};

const repeatOptions: Array<{ id: RepeatMode; label: string; ariaLabel: string }> = [
  { id: 'daily', label: 'Daily', ariaLabel: 'Repeat every day' },
  { id: 'weekdays', label: 'Weekdays', ariaLabel: 'Repeat Monday through Friday' },
  { id: 'weekly', label: 'Weekly', ariaLabel: 'Repeat weekly on this day' },
];

const repeatModeLabel: Record<RepeatMode, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
};

function formatDate(date: Date) {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function getStartDateValue(option: StartDateOption) {
  const now = new Date();
  if (option === 'today') return formatDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(tomorrow);
}

function getInitialDateValue(initialStartDate: string | null | undefined) {
  if (!initialStartDate) return getStartDateValue('today');
  if (!initialStartDate.includes('T')) return initialStartDate.replace(/-/g, '/');
  return formatDate(new Date(initialStartDate));
}

function extractDigits(value: string) {
  return {
    year: value.substring(0, 4).replace(/[^0-9]/g, ''),
    month: value.substring(5, 7).replace(/[^0-9]/g, ''),
    day: value.substring(8, 10).replace(/[^0-9]/g, ''),
  };
}

function getRelativeDateLabel(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  if (diffDays <= 6) return `In ${diffDays} days`;
  if (diffDays <= 13) return `In ${diffDays} days (next week)`;
  if (diffDays <= 30) {
    const weeks = Math.round(diffDays / 7);
    return `In ${weeks} week${weeks > 1 ? 's' : ''}`;
  }

  const months = Math.round(diffDays / 30);
  return `In ${months} month${months > 1 ? 's' : ''}`;
}

function getDateState(dateValue: string): DateState {
  const digits = extractDigits(dateValue);
  if (digits.year.length !== 4 || digits.month.length !== 2 || digits.day.length !== 2) {
    return { valid: false, parsed: null, formatted: null, relative: null };
  }

  const year = Number.parseInt(digits.year, 10);
  const month = Number.parseInt(digits.month, 10);
  const day = Number.parseInt(digits.day, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { valid: false, parsed: null, formatted: null, relative: null };
  }
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, parsed: null, formatted: null, relative: null };
  }

  const parsed = new Date(year, month - 1, day);
  const dateMatchesInput =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;

  if (!dateMatchesInput) return { valid: false, parsed: null, formatted: null, relative: null };

  return {
    valid: true,
    parsed,
    formatted: parsed.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    relative: getRelativeDateLabel(parsed),
  };
}

function toDateKey(dateValue: string) {
  return dateValue.replace(/[^0-9]/g, '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
}

function useRecurrenceModalState({ initialStartDate, onClose, onSave }: RecurrenceModalProps) {
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('daily');
  const [dateValue, setDateValue] = useState(() => getInitialDateValue(initialStartDate));
  const dateState = useMemo(() => getDateState(dateValue), [dateValue]);

  const setStartDate = (option: StartDateOption) => {
    setDateValue(getStartDateValue(option));
  };

  const handleSave = () => {
    if (!dateState.valid) return;

    const startDate = toDateKey(dateValue);
    const recurrence: RecurrenceSchedule = repeatMode === 'weekly'
      ? {
          mode: 'weekly',
          startDate,
          weekdays: [new Date(`${startDate}T00:00:00.000Z`).getUTCDay()],
        }
      : { mode: repeatMode, startDate };

    onSave(recurrence);
    onClose();
  };

  return {
    dateState,
    dateValue,
    handleSave,
    repeatMode,
    setDateValue,
    setRepeatMode,
    setStartDate,
  };
}

function RepeatChoices({
  repeatMode,
  setRepeatMode,
}: {
  repeatMode: RepeatMode;
  setRepeatMode: (mode: RepeatMode) => void;
}) {
  return (
    <div data-order="0">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Repeats</p>
      <div data-layout="horizontal" className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
        {repeatOptions.map((option, index) => (
          <label
            key={option.id}
            className={`flex h-9 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium transition focus-within:ring-2 focus-within:ring-blue-500 ${
              repeatMode === option.id
                ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <input
              data-focusable
              data-tab-consume
              data-order={index.toString()}
              type="radio"
              aria-label={option.ariaLabel}
              name="recurrence-repeat"
              value={option.id}
              checked={repeatMode === option.id}
              onChange={() => setRepeatMode(option.id)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function StartDateChoices({
  dateValue,
  setStartDate,
}: {
  dateValue: string;
  setStartDate: (option: StartDateOption) => void;
}) {
  const options: Array<{ id: StartDateOption; label: string; ariaLabel: string }> = [
    { id: 'today', label: 'Today', ariaLabel: 'Start recurring today' },
    { id: 'tomorrow', label: 'Tomorrow', ariaLabel: 'Start recurring tomorrow' },
  ];

  return (
    <div data-order="1" className="mt-5">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Starts</p>
      <div data-layout="horizontal" className="grid grid-cols-2 gap-2">
        {options.map((option, index) => {
          const checked = dateValue === getStartDateValue(option.id);
          return (
            <label
              key={option.id}
              className={`flex h-11 cursor-pointer items-center justify-between rounded-lg border px-3 text-sm transition focus-within:ring-2 focus-within:ring-blue-500 ${
                checked
                  ? 'border-slate-950 bg-slate-950 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600'
              }`}
            >
              <input
                data-focusable
                data-tab-consume
                data-order={index.toString()}
                type="radio"
                aria-label={option.ariaLabel}
                name="recurrence-start"
                checked={checked}
                onChange={() => setStartDate(option.id)}
                className="sr-only"
              />
              <span>{option.label}</span>
              <span className={`size-2 rounded-full ${checked ? 'bg-cyan-300 dark:bg-cyan-500' : 'bg-transparent'}`} />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CustomStartDateField({
  dateInputRef,
  dateState,
  dateValue,
  handleSave,
  setDateValue,
}: {
  dateInputRef: React.RefObject<MaskedDateInputRef | null>;
  dateState: DateState;
  dateValue: string;
  handleSave: () => void;
  setDateValue: (value: string) => void;
}) {
  return (
    <div data-order="2" className="mt-5">
      <p className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Custom start date</p>
      <MaskedDateInput
        ref={dateInputRef}
        ariaLabel="Custom start date"
        value={dateValue}
        onChange={setDateValue}
        onUserEdit={() => undefined}
        onEnter={handleSave}
        isEmpty={false}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center font-mono text-base caret-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />

      <div className="mt-2 min-h-[2.75rem] space-y-1">
        {dateState.valid && dateState.parsed ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">{dateState.formatted}</p>
            <p className={`text-sm font-medium ${dateState.relative?.includes('ago') ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
              {dateState.relative}
            </p>
          </>
        ) : (
          <p className="text-sm text-red-600 dark:text-red-400">Invalid date</p>
        )}
      </div>
    </div>
  );
}

function RecurrenceSummary({
  dateState,
  repeatMode,
}: {
  dateState: DateState;
  repeatMode: RepeatMode;
}) {
  const dateLabel = dateState.relative ? dateState.relative.toLowerCase() : 'the selected date';

  return (
    <div data-order="3" className="mt-1 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm text-slate-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-slate-200">
      <span className="font-medium text-slate-950 dark:text-white">{repeatModeLabel[repeatMode]}</span>
      <span> from {dateLabel}</span>
    </div>
  );
}

function RecurrenceActions({
  cancelRef,
  dateState,
  onClose,
  onSave,
  saveRef,
}: {
  cancelRef: React.RefObject<HTMLButtonElement | null>;
  dateState: DateState;
  onClose: () => void;
  onSave: () => void;
  saveRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div data-order="2" className="mt-6 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-700">
      <div data-layout="horizontal" className="flex gap-3">
        <button
          type="button"
          ref={cancelRef}
          data-focusable
          data-tab-consume
          data-order="0"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
        <button
          type="button"
          ref={saveRef}
          data-focusable
          data-tab-consume
          data-order="1"
          onClick={onSave}
          disabled={!dateState.valid}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Save
        </button>
      </div>
    </div>
  );
}

const RecurrenceModal: React.FC<RecurrenceModalProps> = (props) => {
  const { isOpen, onClose } = props;
  const modalRef = useRef<HTMLDialogElement>(null);
  const dateInputRef = useRef<MaskedDateInputRef>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const state = useRecurrenceModalState(props);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const modalElement = modalRef.current;
    if (modalElement) {
      NavigationService.pushScope(modalElement, {
        getInitialFocus: (root) => root.querySelector('[data-focusable]') as HTMLElement,
      });
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (modalElement) NavigationService.popScope();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        ref={modalRef}
        open
        aria-modal="true"
        aria-labelledby="recurrence-modal-title"
        data-scope
        className="static m-0 w-full max-w-md rounded-xl border-0 bg-white p-5 text-left shadow-2xl dark:bg-slate-800"
      >
        <div data-region id="recurrence-modal-region" data-tab-consume>
          <div data-layout="vertical">
            <div data-order="0" className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat2 className="size-5 text-slate-500 dark:text-slate-400" />
                <h2 id="recurrence-modal-title" className="text-lg font-semibold text-slate-950 dark:text-slate-100">Repeat</h2>
              </div>
              <button type="button" data-focusable data-tab-consume data-order="0" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-700">
                <X className="size-5" />
              </button>
            </div>

            <div data-order="1" data-layout="vertical">
              <RepeatChoices repeatMode={state.repeatMode} setRepeatMode={state.setRepeatMode} />
              <StartDateChoices dateValue={state.dateValue} setStartDate={state.setStartDate} />
              <CustomStartDateField
                dateInputRef={dateInputRef}
                dateState={state.dateState}
                dateValue={state.dateValue}
                handleSave={state.handleSave}
                setDateValue={state.setDateValue}
              />
              <RecurrenceSummary dateState={state.dateState} repeatMode={state.repeatMode} />
            </div>

            <RecurrenceActions
              cancelRef={cancelRef}
              dateState={state.dateState}
              onClose={onClose}
              onSave={state.handleSave}
              saveRef={saveRef}
            />
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default RecurrenceModal;

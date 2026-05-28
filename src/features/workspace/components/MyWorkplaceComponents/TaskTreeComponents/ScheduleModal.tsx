// ScheduleModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { NavigationService } from '../../../_services/navigationService';
import MaskedDateInput, { MaskedDateInputRef } from './MaskedDateInput';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { dueDate: string | null }) => void;
  initialDueDate?: string | null;
}

type QuickDateOption = 'today' | 'tomorrow' | 'this-week';

type DateState = {
  valid: boolean;
  parsed: Date | null;
  formatted: string | null;
  relative: string | null;
};

const quickDateOptions: Array<{
  id: QuickDateOption | 'none';
  label: string;
  ariaLabel: string;
  value: string;
}> = [
  { id: 'today', label: 'Today', ariaLabel: 'Schedule for today', value: 'today' },
  { id: 'tomorrow', label: 'Tomorrow', ariaLabel: 'Schedule for tomorrow', value: 'tomorrow' },
  { id: 'this-week', label: 'End of this week', ariaLabel: 'Schedule for end of this week', value: 'this-week' },
  { id: 'none', label: 'No deadline', ariaLabel: 'No deadline', value: '' },
];

function formatDate(date: Date) {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function getQuickDateValue(option: QuickDateOption) {
  const now = new Date();
  if (option === 'today') return formatDate(now);
  if (option === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }

  const endOfWeek = new Date(now);
  const dayOfWeek = endOfWeek.getDay();
  endOfWeek.setDate(endOfWeek.getDate() + (dayOfWeek === 0 ? 0 : 7 - dayOfWeek));
  return formatDate(endOfWeek);
}

function getInitialDateValue(initialDueDate: string | null | undefined) {
  if (!initialDueDate) return '//';
  if (!initialDueDate.includes('T')) return initialDueDate.replace(/-/g, '/');
  return formatDate(new Date(initialDueDate));
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

function getDateState(dateValue: string, isEmpty: boolean): DateState {
  if (isEmpty) return { valid: true, parsed: null, formatted: null, relative: null };

  const digits = extractDigits(dateValue);
  if (!digits.year && !digits.month && !digits.day) {
    return { valid: true, parsed: null, formatted: null, relative: null };
  }

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

function useScheduleModalState({ initialDueDate, onClose, onSave }: ScheduleModalProps) {
  const [dateValue, setDateValue] = useState(() => getInitialDateValue(initialDueDate));
  const [isEmpty, setIsEmpty] = useState(!initialDueDate);
  const dateState = useMemo(() => getDateState(dateValue, isEmpty), [dateValue, isEmpty]);

  const setQuickDate = (option: QuickDateOption) => {
    setDateValue(getQuickDateValue(option));
    setIsEmpty(false);
  };

  const clearDate = () => {
    setDateValue('//');
    setIsEmpty(true);
  };

  const handleUserEdit = () => {
    setIsEmpty(false);
  };

  const handleSave = () => {
    if (!dateState.valid) return;

    const dueDate = dateState.parsed && !isEmpty
      ? dateValue.replace(/[^0-9]/g, '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      : null;

    onSave({ dueDate });
    onClose();
  };

  return {
    clearDate,
    dateState,
    dateValue,
    handleSave,
    handleUserEdit,
    isEmpty,
    setDateValue,
    setQuickDate,
  };
}

function ScheduleRadioOption({
  checked,
  label,
  option,
  onSelect,
  order,
}: {
  checked: boolean;
  label: string;
  option: (typeof quickDateOptions)[number];
  onSelect: () => void;
  order: number;
}) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div data-order={order.toString()}>
      <input
        data-focusable
        data-tab-consume
        data-order="0"
        type="radio"
        aria-label={option.ariaLabel}
        name="schedule"
        id={`schedule-${option.id}`}
        value={option.value}
        checked={checked}
        onChange={onSelect}
        onKeyDown={handleKeyDown}
        className="peer sr-only"
      />
      <label
        htmlFor={`schedule-${option.id}`}
        className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-gray-50 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 dark:hover:bg-gray-700"
      >
        <span className={`flex size-4 items-center justify-center rounded-full border-2 ${checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 dark:border-gray-500'}`}>
          {checked && <span className="size-2 rounded-full bg-white" />}
        </span>
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      </label>
    </div>
  );
}

function ScheduleChoices({
  clearDate,
  dateValue,
  isEmpty,
  setQuickDate,
}: {
  clearDate: () => void;
  dateValue: string;
  isEmpty: boolean;
  setQuickDate: (option: QuickDateOption) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Set deadline to</h3>
      <div data-layout="vertical" className="space-y-2">
        {quickDateOptions.map((option, index) => {
          const checked = option.id === 'none'
            ? isEmpty
            : !isEmpty && dateValue === getQuickDateValue(option.id as QuickDateOption);
          const onSelect = option.id === 'none' ? clearDate : () => setQuickDate(option.id as QuickDateOption);

          return (
            <ScheduleRadioOption
              key={option.id}
              checked={checked}
              label={option.label}
              option={option}
              onSelect={onSelect}
              order={index}
            />
          );
        })}
      </div>
    </div>
  );
}

function CustomDateField({
  dateInputRef,
  dateState,
  dateValue,
  handleSave,
  handleUserEdit,
  isEmpty,
  setDateValue,
}: {
  dateInputRef: React.RefObject<MaskedDateInputRef | null>;
  dateState: DateState;
  dateValue: string;
  handleSave: () => void;
  handleUserEdit: () => void;
  isEmpty: boolean;
  setDateValue: (value: string) => void;
}) {
  return (
    <div data-order="4" className="mt-6">
      <p className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Or set custom deadline</p>
      <MaskedDateInput
        ref={dateInputRef}
        ariaLabel="Custom deadline"
        value={dateValue}
        onChange={setDateValue}
        onUserEdit={handleUserEdit}
        onEnter={handleSave}
        isEmpty={isEmpty}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-wider caret-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />

      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">YYYY/MM/DD • Click segment, use ↑↓ to adjust</p>

      <div className="mt-2 min-h-[3rem] space-y-1">
        {isEmpty ? (
          <p className="text-sm italic text-gray-500 dark:text-gray-400">No deadline set</p>
        ) : dateState.valid && dateState.parsed ? (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">{dateState.formatted}</p>
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

function ScheduleActions({
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
    <div data-order="2" className="mt-6 flex justify-end gap-4">
      <div data-layout="horizontal" className="flex gap-4">
        <button
          type="button"
          ref={cancelRef}
          data-focusable
          data-tab-consume
          data-order="0"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
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
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

const ScheduleModal: React.FC<ScheduleModalProps> = (props) => {
  const { isOpen, onClose } = props;
  const modalRef = useRef<HTMLDialogElement>(null);
  const dateInputRef = useRef<MaskedDateInputRef>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const state = useScheduleModalState(props);

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
        aria-labelledby="schedule-modal-title"
        data-scope
        className="static m-0 w-full max-w-md rounded-lg border-0 bg-white p-6 text-left shadow-xl dark:bg-gray-800"
      >
        <div data-region id="schedule-modal-region" data-tab-consume>
          <div data-layout="vertical">
            <div data-order="0" className="mb-6 flex items-center justify-between">
              <h2 id="schedule-modal-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">Schedule Task</h2>
              <button type="button" data-focusable data-tab-consume data-order="0" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700">
                <X className="size-5" />
              </button>
            </div>

            <div data-order="1">
              <ScheduleChoices clearDate={state.clearDate} dateValue={state.dateValue} isEmpty={state.isEmpty} setQuickDate={state.setQuickDate} />
              <CustomDateField
                dateInputRef={dateInputRef}
                dateState={state.dateState}
                dateValue={state.dateValue}
                handleSave={state.handleSave}
                handleUserEdit={state.handleUserEdit}
                isEmpty={state.isEmpty}
                setDateValue={state.setDateValue}
              />
            </div>

            <ScheduleActions cancelRef={cancelRef} dateState={state.dateState} onClose={onClose} onSave={state.handleSave} saveRef={saveRef} />
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default ScheduleModal;

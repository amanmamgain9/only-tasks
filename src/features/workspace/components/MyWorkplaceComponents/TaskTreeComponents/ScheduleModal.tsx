// ScheduleModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { NavigationService } from '../../../_services/navigationService';
import MaskedDateInput, { MaskedDateInputRef } from './MaskedDateInput';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { dueDate: string | null }) => void;
  initialDueDate?: string | null;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialDueDate = null
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<MaskedDateInputRef>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  const getTodayFormatted = () => {
    const now = new Date();
    const year = now.getFullYear().toString().padStart(4, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  const getTomorrowFormatted = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear().toString().padStart(4, '0');
    const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
    const day = tomorrow.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  const getEndOfWeekFormatted = () => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const daysUntilSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
    const year = endOfWeek.getFullYear().toString().padStart(4, '0');
    const month = (endOfWeek.getMonth() + 1).toString().padStart(2, '0');
    const day = endOfWeek.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  // ✅ UPDATED - Handle both UTC timestamps and YYYY-MM-DD formats
  const getInitialDateValue = () => {
    if (initialDueDate) {
      // Check if it's an ISO timestamp (contains 'T')
      if (initialDueDate.includes('T')) {
        // It's a UTC timestamp, convert to local date
        const date = new Date(initialDueDate);
        const year = date.getFullYear().toString().padStart(4, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
      } else {
        // It's already a YYYY-MM-DD format, just replace dashes
        return initialDueDate.replace(/-/g, '/');
      }
    }
    return '//';
  };

  const [dateValue, setDateValue] = useState(getInitialDateValue());
  const [isEmpty, setIsEmpty] = useState(!initialDueDate);

  useEffect(() => {
    if (!isOpen) return;
    
    const modalElement = modalRef.current;
    if (modalElement) {
      NavigationService.pushScope(modalElement, {
        getInitialFocus: (root) => {
          return root.querySelector('[data-focusable]') as HTMLElement;
        }
      });
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (modalElement) {
        NavigationService.popScope();
      }
    };
  }, [isOpen, onClose]);

  const extractDigits = (value: string): { year: string; month: string; day: string } => {
    return {
      year: value.substring(0, 4).replace(/[^0-9]/g, ''),
      month: value.substring(5, 7).replace(/[^0-9]/g, ''),
      day: value.substring(8, 10).replace(/[^0-9]/g, '')
    };
  };

  const dateState = useMemo(() => {
    if (isEmpty) {
      return { valid: true, parsed: null, formatted: null, relative: null };
    }

    const digits = extractDigits(dateValue);

    if (!digits.year && !digits.month && !digits.day) {
      return { valid: true, parsed: null, formatted: null, relative: null };
    }

    if (digits.year.length !== 4 || digits.month.length !== 2 || digits.day.length !== 2) {
      return { valid: false, parsed: null, formatted: null, relative: null };
    }

    const y = parseInt(digits.year);
    const m = parseInt(digits.month);
    const d = parseInt(digits.day);

    if (isNaN(y) || isNaN(m) || isNaN(d) || y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) {
      return { valid: false, parsed: null, formatted: null, relative: null };
    }

    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      return { valid: false, parsed: null, formatted: null, relative: null };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let relative: string;
    if (diffDays === 0) relative = 'Today';
    else if (diffDays === 1) relative = 'Tomorrow';
    else if (diffDays === -1) relative = 'Yesterday';
    else if (diffDays < 0) relative = `${Math.abs(diffDays)} days ago`;
    else if (diffDays <= 6) relative = `In ${diffDays} days`;
    else if (diffDays <= 13) relative = `In ${diffDays} days (next week)`;
    else if (diffDays <= 30) {
      const weeks = Math.round(diffDays / 7);
      relative = `In ${weeks} week${weeks > 1 ? 's' : ''}`;
    } else {
      const months = Math.round(diffDays / 30);
      relative = `In ${months} month${months > 1 ? 's' : ''}`;
    }

    const formatted = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return { valid: true, parsed: date, formatted, relative };
  }, [dateValue, isEmpty]);

  const setQuickDate = (option: 'today' | 'tomorrow' | 'this-week') => {
    const now = new Date();
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth() + 1;
    let targetDay = now.getDate();

    if (option === 'tomorrow') {
      targetDay += 1;
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
      if (targetDay > daysInMonth) {
        targetDay = 1;
        targetMonth += 1;
        if (targetMonth > 12) {
          targetMonth = 1;
          targetYear += 1;
        }
      }
    } else if (option === 'this-week') {
      const currentDayOfWeek = now.getDay();
      const daysUntilSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;
      
      const endOfWeek = new Date(now);
      endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
      
      targetYear = endOfWeek.getFullYear();
      targetMonth = endOfWeek.getMonth() + 1;
      targetDay = endOfWeek.getDate();
    }

    const newValue = `${targetYear.toString().padStart(4, '0')}/${targetMonth.toString().padStart(2, '0')}/${targetDay.toString().padStart(2, '0')}`;
    setDateValue(newValue);
    setIsEmpty(false);
  };

  const clearDate = () => {
    setDateValue('//');
    setIsEmpty(true);
  };

  const handleDateChange = (newValue: string) => {
    setDateValue(newValue);
  };

  const handleUserEdit = () => {
    setIsEmpty(false);
  };

  const handleRadioKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  const handleSave = () => {
    if (!dateState.valid) return;

    const dueDate = dateState.parsed && !isEmpty
      ? dateValue.replace(/[^0-9]/g, '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      : null;

    onSave({ dueDate });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        data-scope
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div data-region id="schedule-modal-region" data-tab-consume>
          <div data-layout="vertical">
            {/* Header with close button - order 0 */}
            <div data-order="0" className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Schedule Task
              </h2>
              <button
                data-focusable
                data-tab-consume
                data-order="0"
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick options section - order 1 */}
            <div data-order="1">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Set deadline to
                </h3>
                <div data-layout="vertical" className="space-y-2">
                  {/* Today */}
                  <div data-order="0">
                    <input
                      data-focusable
                      data-tab-consume
                      data-order="0"
                      type="radio"
                      name="schedule"
                      id="schedule-today"
                      value="today"
                      checked={!isEmpty && dateValue === getTodayFormatted()}
                      onChange={() => setQuickDate('today')}
                      onKeyDown={(e) => handleRadioKeyDown(e, () => setQuickDate('today'))}
                      className="sr-only peer"
                    />
                    <label 
                      htmlFor="schedule-today"
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500"
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        !isEmpty && dateValue === getTodayFormatted()
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {!isEmpty && dateValue === getTodayFormatted() && (
                          <span className="w-2 h-2 bg-white rounded-full"></span>
                        )}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Today
                      </span>
                    </label>
                  </div>

                  {/* Tomorrow */}
                  <div data-order="1">
                    <input
                      data-focusable
                      data-tab-consume
                      data-order="0"
                      type="radio"
                      name="schedule"
                      id="schedule-tomorrow"
                      value="tomorrow"
                      checked={!isEmpty && dateValue === getTomorrowFormatted()}
                      onChange={() => setQuickDate('tomorrow')}
                      onKeyDown={(e) => handleRadioKeyDown(e, () => setQuickDate('tomorrow'))}
                      className="sr-only peer"
                    />
                    <label 
                      htmlFor="schedule-tomorrow"
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500"
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        !isEmpty && dateValue === getTomorrowFormatted()
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {!isEmpty && dateValue === getTomorrowFormatted() && (
                          <span className="w-2 h-2 bg-white rounded-full"></span>
                        )}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Tomorrow
                      </span>
                    </label>
                  </div>

                  {/* End of this week */}
                  <div data-order="2">
                    <input
                      data-focusable
                      data-tab-consume
                      data-order="0"
                      type="radio"
                      name="schedule"
                      id="schedule-week"
                      value="this-week"
                      checked={!isEmpty && dateValue === getEndOfWeekFormatted()}
                      onChange={() => setQuickDate('this-week')}
                      onKeyDown={(e) => handleRadioKeyDown(e, () => setQuickDate('this-week'))}
                      className="sr-only peer"
                    />
                    <label 
                      htmlFor="schedule-week"
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500"
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        !isEmpty && dateValue === getEndOfWeekFormatted()
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {!isEmpty && dateValue === getEndOfWeekFormatted() && (
                          <span className="w-2 h-2 bg-white rounded-full"></span>
                        )}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        End of this week
                      </span>
                    </label>
                  </div>

                  {/* No deadline */}
                  <div data-order="3">
                    <input
                      data-focusable
                      data-tab-consume
                      data-order="0"
                      type="radio"
                      name="schedule"
                      id="schedule-none"
                      value=""
                      checked={isEmpty}
                      onChange={clearDate}
                      onKeyDown={(e) => handleRadioKeyDown(e, clearDate)}
                      className="sr-only peer"
                    />
                    <label 
                      htmlFor="schedule-none"
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500"
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isEmpty
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {isEmpty && (
                          <span className="w-2 h-2 bg-white rounded-full"></span>
                        )}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        No deadline
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Custom date input - order 4 */}
              <div data-order="4" className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Or set custom deadline
                </label>
                <MaskedDateInput
                  ref={dateInputRef}
                  value={dateValue}
                  onChange={handleDateChange}
                  onUserEdit={handleUserEdit}
                  onEnter={handleSave}
                  isEmpty={isEmpty}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 text-center text-lg tracking-wider font-mono caret-blue-500"
                />

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  YYYY/MM/DD • Click segment, use ↑↓ to adjust
                </p>

                <div className="mt-2 space-y-1 min-h-[3rem]">
                  {isEmpty ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No deadline set
                    </p>
                  ) : dateState.valid && dateState.parsed ? (
                    <>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {dateState.formatted}
                      </p>
                      <p
                        className={`text-sm font-medium ${
                          dateState.relative?.includes('ago')
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {dateState.relative}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-red-600 dark:text-red-400">Invalid date</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons - order 2 */}
            <div data-order="2" className="flex justify-end gap-4 mt-6">
              <div data-layout="horizontal" className="flex gap-4">
                <button
                  ref={cancelRef}
                  data-focusable
                  data-tab-consume
                  data-order="0"
                  onClick={onClose}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  ref={saveRef}
                  data-focusable
                  data-tab-consume
                  data-order="1"
                  onClick={handleSave}
                  disabled={!dateState.valid}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;

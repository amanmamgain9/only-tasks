// MaskedDateInput.tsx
import React, { useRef, forwardRef, useImperativeHandle } from 'react';

interface MaskedDateInputProps {
  value: string;
  onChange: (value: string) => void;
  onUserEdit?: () => void;
  onEnter?: () => void;
  onTab?: (shiftKey: boolean) => void;
  className?: string;
  isEmpty?: boolean;
  ariaLabel?: string;
}

export interface MaskedDateInputRef {
  focus: () => void;
}

const MaskedDateInput = forwardRef<MaskedDateInputRef, MaskedDateInputProps>(
  ({ value, onChange, onUserEdit, onEnter, onTab, className = '', isEmpty = false, ariaLabel = 'Date' }, ref) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const yearRef = useRef<HTMLInputElement>(null);
    const monthRef = useRef<HTMLInputElement>(null);
    const dayRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => yearRef.current?.focus()
    }));

    const parts = value.split('/');
    const year = parts[0] || '';
    const month = parts[1] || '';
    const day = parts[2] || '';

    const updateValue = (y: string, m: string, d: string) => {
      onChange(`${y}/${m}/${d}`);
      onUserEdit?.();
    };

    const handleInput = (
      e: React.FormEvent<HTMLInputElement>,
      field: 'year' | 'month' | 'day',
      maxLen: number,
      nextRef?: HTMLInputElement | null
    ) => {
      let val = e.currentTarget.value.replace(/[^0-9]/g, '');
      if (val.length > maxLen) val = val.slice(0, maxLen);

      if (field === 'month' && val.length === 2) {
        const monthNum = parseInt(val);
        if (monthNum > 12) val = '12';
        if (monthNum < 1) val = '01';
      }

      if (field === 'day' && val.length === 2) {
        const dayNum = parseInt(val);
        if (dayNum > 31) val = '31';
        if (dayNum < 1) val = '01';
      }

      const newYear = field === 'year' ? val : year;
      const newMonth = field === 'month' ? val : month;
      const newDay = field === 'day' ? val : day;
      
      updateValue(newYear, newMonth, newDay);

      if (val.length === maxLen && nextRef) {
        nextRef.focus();
        nextRef.select();
      }
    };

    const adjustValue = (field: 'year' | 'month' | 'day', delta: number) => {
      if (field === 'year' && year.length === 4) {
        const val = Math.max(1000, Math.min(9999, parseInt(year) + delta));
        updateValue(val.toString(), month, day);
      } else if (field === 'month' && month.length === 2) {
        let val = parseInt(month) + delta;
        if (val > 12) val = 1;
        if (val < 1) val = 12;
        updateValue(year, val.toString().padStart(2, '0'), day);
      } else if (field === 'day' && day.length === 2) {
        const y = parseInt(year) || new Date().getFullYear();
        const m = parseInt(month) || 1;
        const maxDay = new Date(y, m, 0).getDate();
        let val = parseInt(day) + delta;
        if (val > maxDay) val = 1;
        if (val < 1) val = maxDay;
        updateValue(year, month, val.toString().padStart(2, '0'));
      }
    };

    const handleKeyDown = (
      e: React.KeyboardEvent<HTMLInputElement>,
      field: 'year' | 'month' | 'day',
      prevRef?: HTMLInputElement | null,
      nextRef?: HTMLInputElement | null
    ) => {
      console.log('KeyDown in MaskedDateInput:', e.key, 'on field', field);

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        adjustValue(field, 1);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        adjustValue(field, -1);
        return;
      }

      if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && prevRef) {
        e.preventDefault();
        prevRef.focus();
        prevRef.setSelectionRange(prevRef.value.length, prevRef.value.length);
        return;
      }

      if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0 && prevRef) {
        e.preventDefault();
        prevRef.focus();
        return;
      }

      if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length && nextRef) {
        e.preventDefault();
        nextRef.focus();
        return;
      }
    };

    return (
      <div 
        ref={wrapperRef}
        className={`inline-flex items-center font-mono ${className}`}
      >
        <input
          ref={yearRef}
          type="text"
          inputMode="numeric"
          aria-label={`${ariaLabel} year`}
          value={year}
          placeholder="YYYY"
          onInput={(e) => handleInput(e, 'year', 4, monthRef.current)}
          onKeyDown={(e) => handleKeyDown(e, 'year', undefined, monthRef.current)}
          className="bg-transparent border-none outline-none p-0 m-0 text-center placeholder:italic placeholder:opacity-30"
          style={{ width: '4.5ch' }}
        />
        <span className="select-none">/</span>
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          aria-label={`${ariaLabel} month`}
          value={month}
          placeholder="MM"
          onInput={(e) => handleInput(e, 'month', 2, dayRef.current)}
          onKeyDown={(e) => handleKeyDown(e, 'month', yearRef.current, dayRef.current)}
          className="bg-transparent border-none outline-none p-0 m-0 text-center placeholder:italic placeholder:opacity-30"
          style={{ width: '2.5ch' }}
        />
        <span className="select-none">/</span>
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          aria-label={`${ariaLabel} day`}
          value={day}
          placeholder="DD"
          onInput={(e) => handleInput(e, 'day', 2)}
          onKeyDown={(e) => handleKeyDown(e, 'day', monthRef.current)}
          className="bg-transparent border-none outline-none p-0 m-0 text-center placeholder:italic placeholder:opacity-30"
          style={{ width: '2.5ch' }}
        />
      </div>
    );
  }
);

MaskedDateInput.displayName = 'MaskedDateInput';

export default MaskedDateInput;

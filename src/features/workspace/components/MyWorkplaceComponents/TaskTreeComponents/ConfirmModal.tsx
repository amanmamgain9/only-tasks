// ConfirmModal.tsx
import React, { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Auto-focus cancel button and setup escape handler
  useEffect(() => {
    cancelRef.current?.focus();
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const handleCancelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      confirmRef.current?.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      confirmRef.current?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      confirmRef.current?.focus(); // Wrap around to confirm
    }
  };

  const handleConfirmKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onConfirm();
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      cancelRef.current?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      cancelRef.current?.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      cancelRef.current?.focus(); // Wrap around to cancel
    }
  };

  return (
    <div 
      role="presentation"
      className="fixed inset-0 backdrop-blur-sm bg-slate-950/20 dark:bg-slate-950/40 flex items-center justify-center z-50 animate-in fade-in duration-200"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <dialog
        open
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="static m-0 w-full max-w-sm rounded-xl border border-gray-200/50 bg-white/95 p-6 text-left shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200 dark:border-gray-700/50 dark:bg-gray-900/95"
      >
        <h3 id="confirm-modal-title" className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            onKeyDown={handleCancelKeyDown}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500"
          >
            {cancelText}
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={onConfirm}
            onKeyDown={handleConfirmKeyDown}
            className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            {confirmText}
          </button>
        </div>
      </dialog>
    </div>
  );
}

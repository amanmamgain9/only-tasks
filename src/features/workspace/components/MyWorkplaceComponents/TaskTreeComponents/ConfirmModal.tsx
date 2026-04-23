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
      className="fixed inset-0 backdrop-blur-sm bg-black/20 dark:bg-black/40 flex items-center justify-center z-50 animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div 
        className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            onKeyDown={handleCancelKeyDown}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            onKeyDown={handleConfirmKeyDown}
            className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
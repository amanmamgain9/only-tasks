"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
  width?: string;
};

export default function Modal({
  open,
  onOpenChange,
  children,
  title = "Modal",
  width = "max-w-xl",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      role="presentation"
    >
      <dialog
        open
        aria-modal="true"
        aria-label={title}
        className={`static m-0 w-full ${width} overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-left shadow-2xl dark:border-slate-700 dark:bg-slate-900`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
          <button
            type="button"
            data-focusable
            data-order="99"
            data-tab-consume
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </dialog>
    </div>
  );
}

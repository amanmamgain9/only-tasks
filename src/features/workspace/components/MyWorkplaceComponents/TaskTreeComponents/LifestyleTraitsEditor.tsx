import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  LIFESTYLE_TRAIT_DEFINITIONS,
  getLifestyleTraitLabel,
  normalizeLifestyleTraitAllocations,
  validateLifestyleTraitAllocations,
  type LifestyleTraitAllocation,
  type LifestyleTraitId,
} from "@/features/categories/taskCategories";

type LifestyleTraitsEditorProps = {
  isOpen: boolean;
  title: string;
  allocations: LifestyleTraitAllocation[];
  onClose: () => void;
  onSave: (allocations: LifestyleTraitAllocation[]) => void;
};

const traitDescriptions = new Map(
  LIFESTYLE_TRAIT_DEFINITIONS.map((trait) => [trait.id, trait.description]),
);

function findNextTrait(allocations: LifestyleTraitAllocation[]): LifestyleTraitId | null {
  const selected = new Set(allocations.map((allocation) => allocation.trait));
  return LIFESTYLE_TRAIT_DEFINITIONS.find((trait) => !selected.has(trait.id))?.id ?? null;
}

function getSelectOptions(currentTrait: LifestyleTraitId, allocations: LifestyleTraitAllocation[]) {
  const selected = new Set(allocations.map((allocation) => allocation.trait));
  return LIFESTYLE_TRAIT_DEFINITIONS.filter((trait) => trait.id === currentTrait || !selected.has(trait.id));
}

export default function LifestyleTraitsEditor({
  isOpen,
  title,
  allocations,
  onClose,
  onSave,
}: LifestyleTraitsEditorProps) {
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<LifestyleTraitAllocation[]>(() => (
    normalizeLifestyleTraitAllocations(allocations)
  ));

  useEffect(() => {
    if (!isOpen) return;
    const normalized = normalizeLifestyleTraitAllocations(allocations);
    setDraft(normalized.length > 0 ? normalized : [{ trait: "learning", weight: 100 }]);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [allocations, isOpen, onClose]);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => saveButtonRef.current?.focus());
  }, [isOpen]);

  const total = useMemo(() => draft.reduce((sum, allocation) => sum + allocation.weight, 0), [draft]);
  const validation = useMemo(() => validateLifestyleTraitAllocations(draft), [draft]);
  const canAddTrait = draft.length < LIFESTYLE_TRAIT_DEFINITIONS.length && findNextTrait(draft) !== null;

  if (!isOpen) return null;

  const updateDraft = (index: number, nextAllocation: LifestyleTraitAllocation) => {
    setDraft((current) => current.map((allocation, currentIndex) => (
      currentIndex === index ? nextAllocation : allocation
    )));
  };

  const removeAllocation = (index: number) => {
    setDraft((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      return next.length > 0 ? next : [{ trait: "learning", weight: 100 }];
    });
  };

  const addAllocation = () => {
    const trait = findNextTrait(draft);
    if (!trait) return;

    const remaining = Math.max(1, 100 - total);
    setDraft((current) => [...current, { trait, weight: remaining }]);
  };

  const handleSave = () => {
    const result = validateLifestyleTraitAllocations(draft);
    if (!result.ok) return;
    onSave(result.allocations);
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-sm dark:bg-slate-950/50"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        open
        aria-modal="true"
        aria-labelledby="lifestyle-traits-editor-title"
        className="static m-0 w-full max-w-xl rounded-lg border border-slate-200 bg-white p-0 text-left shadow-2xl dark:border-white/10 dark:bg-slate-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h3 id="lifestyle-traits-editor-title" className="text-base font-semibold text-slate-950 dark:text-white">
              Lifestyle Traits
            </h3>
            <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
              {title.trim() || "Untitled task"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close lifestyle traits editor"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {draft.map((allocation, index) => (
            <div key={`${allocation.trait}-${index}`} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Trait</span>
                  <select
                    value={allocation.trait}
                    onChange={(event) => updateDraft(index, {
                      ...allocation,
                      trait: event.target.value as LifestyleTraitId,
                    })}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:ring-2 focus:ring-cyan-300 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  >
                    {getSelectOptions(allocation.trait, draft).map((trait) => (
                      <option key={trait.id} value={trait.id}>{trait.label}</option>
                    ))}
                  </select>
                </label>

                <label className="w-full sm:w-28">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Percent</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={allocation.weight}
                    onChange={(event) => updateDraft(index, {
                      ...allocation,
                      weight: Math.max(0, Math.min(100, Number(event.target.value) || 0)),
                    })}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:ring-2 focus:ring-cyan-300 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => removeAllocation(index)}
                  disabled={draft.length === 1}
                  className="mt-5 inline-flex size-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label={`Remove ${getLifestyleTraitLabel(allocation.trait)}`}
                >
                  <X className="size-4" />
                </button>
              </div>

              <input
                type="range"
                min={1}
                max={100}
                value={allocation.weight}
                onChange={(event) => updateDraft(index, {
                  ...allocation,
                  weight: Number(event.target.value),
                })}
                className="mt-3 w-full accent-cyan-500"
                aria-label={`${getLifestyleTraitLabel(allocation.trait)} percentage`}
              />

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {traitDescriptions.get(allocation.trait)}
              </p>
            </div>
          ))}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={addAllocation}
              disabled={!canAddTrait}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <Plus className="size-4" />
              Add Trait
            </button>

            <div className={`text-sm font-medium ${total === 100 ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>
              Total: {total}%
            </div>
          </div>

          {!validation.ok && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
              {validation.error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            ref={saveButtonRef}
            onClick={handleSave}
            disabled={!validation.ok}
            className="h-9 rounded-md bg-slate-950 px-4 text-sm font-medium text-white outline-none transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            Save
          </button>
        </div>
      </dialog>
    </div>
  );
}

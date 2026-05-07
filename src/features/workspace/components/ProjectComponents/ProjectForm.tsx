"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Edit3, Folder, Loader2, Plus } from "lucide-react";
import type { Project, ProjectFormData } from "../../types";
import { NavigationService } from "../../_services/navigationService";

type ProjectFormProps = {
  selectedProject: Project | null;
  onSave: (projectData: ProjectFormData) => Promise<void>;
  onComplete: () => void;
  closeModal: () => void;
  isLoading?: boolean;
  error?: Error | null;
};

const projectTypes: Array<{
  value: Project["type"];
  label: string;
  description: string;
}> = [
  {
    value: "main",
    label: "Main Project",
    description: "Primary workstream or core initiative.",
  },
  {
    value: "side_project",
    label: "Side Project",
    description: "Secondary project, experiment, or personal initiative.",
  },
  {
    value: "chore",
    label: "Chore",
    description: "Recurring or operational work.",
  },
];

export default function ProjectForm({
  selectedProject,
  onSave,
  onComplete,
  closeModal,
  isLoading = false,
  error = null,
}: ProjectFormProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const isEditMode = selectedProject !== null;
  const [title, setTitle] = useState(selectedProject?.title || "");
  const [type, setType] = useState<Project["type"]>(selectedProject?.type || "main");
  const [validationError, setValidationError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !isLoading;
  const ButtonIcon = isEditMode ? Edit3 : Plus;

  useEffect(() => {
    if (!modalRef.current) return;

    NavigationService.pushScope(modalRef.current, {
      getInitialFocus: (root) => root.querySelector("[data-focusable]") as HTMLElement | null,
    });

    return () => {
      NavigationService.popScope();
    };
  }, []);

  const handleCancel = useCallback(() => {
    closeModal();
  }, [closeModal]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleCancel();
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [handleCancel]);

  const submitLabel = useMemo(() => {
    if (isLoading) return isEditMode ? "Updating..." : "Creating...";
    return isEditMode ? "Update Project" : "Create Project";
  }, [isEditMode, isLoading]);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setValidationError("Project title is required.");
      return;
    }

    setValidationError(null);
    await onSave({ title: trimmedTitle, type });
    onComplete();
  };

  return (
    <div ref={modalRef} data-scope className="max-h-[75vh] overflow-y-auto">
      <div data-region="project-form" data-order="1">
        <div data-layout="vertical" data-order="1" className="space-y-5">
          <div data-layout="vertical" data-order="1" className="space-y-2">
            <label htmlFor="project-title" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Project title
            </label>
            <div className="relative">
              <Folder className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="project-title"
                data-focusable
                data-order="1"
                data-tab-consume
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={isLoading}
                className="w-full rounded-xl border-2 border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                placeholder="What project do you want to work on?"
              />
            </div>
            {validationError ? <p className="text-sm font-medium text-red-500">{validationError}</p> : null}
          </div>

          <div data-layout="vertical" data-order="2" className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Project type</p>
            <div data-layout="vertical" data-order="1" className="grid gap-3">
              {projectTypes.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  data-focusable
                  data-order={index + 1}
                  data-tab-consume
                  disabled={isLoading}
                  onClick={() => setType(option.value)}
                  className={`rounded-xl border-2 p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60 ${
                    type === option.value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/35"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600"
                  }`}
                >
                  <span className="block font-semibold text-slate-950 dark:text-slate-50">{option.label}</span>
                  <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">{isEditMode ? "Unable to update project" : "Unable to create project"}</p>
                <p className="mt-1 text-sm">{error.message}</p>
              </div>
            </div>
          ) : null}

          <div data-layout="horizontal" data-order="3" className="flex gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <button
              type="button"
              data-focusable
              data-order="1"
              data-tab-consume
              disabled={isLoading}
              onClick={handleCancel}
              className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              data-focusable
              data-order="2"
              data-tab-consume
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ButtonIcon className="h-5 w-5" />}
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

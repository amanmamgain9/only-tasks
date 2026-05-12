"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle,
  Edit3,
  Folder,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import type { Project, ProjectFormData } from "../../types";
import { NavigationService } from "../../_services/navigationService";

type ProjectFormProps = {
  selectedProject: Project | null;
  onSave: (projectData: ProjectFormData) => Promise<void>;
  onStatusChange?: (status: Project["status"]) => Promise<void>;
  onArchive?: () => Promise<void>;
  onUnarchive?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onComplete: () => void;
  closeModal: () => void;
  isLoading?: boolean;
  isLifecycleLoading?: boolean;
  error?: Error | null;
  lifecycleError?: Error | null;
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
  onStatusChange,
  onArchive,
  onUnarchive,
  onDelete,
  onComplete,
  closeModal,
  isLoading = false,
  isLifecycleLoading = false,
  error = null,
  lifecycleError = null,
}: ProjectFormProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const isEditMode = selectedProject !== null;
  const [title, setTitle] = useState(selectedProject?.title || "");
  const [type, setType] = useState<Project["type"]>(selectedProject?.type || "main");
  const [validationError, setValidationError] = useState<string | null>(null);

  const isBusy = isLoading || isLifecycleLoading;
  const canSubmit = title.trim().length > 0 && !isBusy;
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

  const runLifecycleAction = async (
    action: (() => Promise<void>) | undefined,
    confirmationMessage?: string,
  ) => {
    if (!action || isBusy) return;
    if (confirmationMessage && !window.confirm(confirmationMessage)) return;

    await action();
    onComplete();
  };

  const statusActions = useMemo(() => {
    if (!selectedProject || !onStatusChange) return [];

    switch (selectedProject.status) {
      case "active":
        return [
          { label: "Put on Hold", icon: PauseCircle, status: "on_hold" as const },
          { label: "Mark Complete", icon: CheckCircle, status: "completed" as const },
          { label: "Cancel Project", icon: XCircle, status: "cancelled" as const },
        ];
      case "on_hold":
        return [
          { label: "Activate", icon: PlayCircle, status: "active" as const },
          { label: "Mark Complete", icon: CheckCircle, status: "completed" as const },
          { label: "Cancel Project", icon: XCircle, status: "cancelled" as const },
        ];
      case "completed":
      case "cancelled":
        return [{ label: "Reactivate", icon: RotateCcw, status: "active" as const }];
      default:
        return [];
    }
  }, [onStatusChange, selectedProject]);

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
                disabled={isBusy}
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
                  disabled={isBusy}
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

          {isEditMode ? (
            <div data-layout="vertical" data-order="3" className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Project lifecycle</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Current status: {selectedProject.status.replace("_", " ")}
              </p>

              {statusActions.length > 0 ? (
                <div data-layout="horizontal" data-order="1" className="mt-3 grid gap-2 sm:grid-cols-3">
                  {statusActions.map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.status}
                        type="button"
                        data-focusable
                        data-order={index + 1}
                        data-tab-consume
                        disabled={isBusy}
                        onClick={() => {
                          if (onStatusChange) void runLifecycleAction(() => onStatusChange(action.status));
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        <Icon className="h-4 w-4" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div data-layout="horizontal" data-order="2" className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedProject.status === "archived" ? (
                  <button
                    type="button"
                    data-focusable
                    data-order="1"
                    data-tab-consume
                    disabled={isBusy || !onUnarchive}
                    onClick={() => runLifecycleAction(onUnarchive)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-white px-3 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-400/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-green-900/70 dark:bg-slate-950 dark:text-green-300 dark:hover:bg-green-950/25"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Unarchive
                  </button>
                ) : (
                  <button
                    type="button"
                    data-focusable
                    data-order="1"
                    data-tab-consume
                    disabled={isBusy || !onArchive}
                    onClick={() =>
                      runLifecycleAction(
                        onArchive,
                        "Archive this project? It will leave the active workspace tabs.",
                      )
                    }
                    className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/70 dark:bg-slate-950 dark:text-amber-300 dark:hover:bg-amber-950/25"
                  >
                    <Archive className="h-4 w-4" />
                    Archive
                  </button>
                )}

                <button
                  type="button"
                  data-focusable
                  data-order="2"
                  data-tab-consume
                  disabled={isBusy || !onDelete}
                  onClick={() =>
                    runLifecycleAction(
                      onDelete,
                      "Delete this project? It will be hidden from the workspace and can be restored only from backend tools.",
                    )
                  }
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-400/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/70 dark:bg-slate-950 dark:text-red-300 dark:hover:bg-red-950/25"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ) : null}

          {error || lifecycleError ? (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  {lifecycleError ? "Unable to update project lifecycle" : isEditMode ? "Unable to update project" : "Unable to create project"}
                </p>
                <p className="mt-1 text-sm">{(lifecycleError || error)?.message}</p>
              </div>
            </div>
          ) : null}

          <div data-layout="horizontal" data-order="4" className="flex gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <button
              type="button"
              data-focusable
              data-order="1"
              data-tab-consume
              disabled={isBusy}
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

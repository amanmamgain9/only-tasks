"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import MyWorkplaceComponent from "./MyWorkplaceComponents/MyWorkplaceComponent";
import ProgressWorkspaceComponent from "./ProgressComponents/ProgressWorkspaceComponent";
import DayRecapWorkspaceComponent from "./ReviewComponents/DayRecapWorkspaceComponent";
import ReviewWorkspaceComponent from "./ReviewComponents/ReviewWorkspaceComponent";
import { NavigationService } from "../_services/navigationService";
import { TASK_OPERATIONS_SAVED_EVENT, type TaskOperationsSavedDetail } from "../_events/taskOperationEvents";
import { progressSummaryKey } from "../_hooks/useProgressSummary";
import { timeReviewKey } from "../_hooks/useTimeReview";
import type { AuthenticatedUser } from "@/server/auth";

function WorkspaceShellFallback() {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.12),rgba(255,255,255,0)),linear-gradient(135deg,#f8fafc_0%,#ffffff_48%,#f1f5f9_100%)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.18),rgba(0,0,0,0)),linear-gradient(135deg,#020617_0%,#0f172a_48%,#1e293b_100%)]">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="rounded-3xl border border-slate-200 bg-white/70 px-8 py-6 text-center shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading workspace</p>
        </div>
      </div>
    </div>
  );
}

type WorkspaceAppProps = {
  viewer: AuthenticatedUser;
};

export default function WorkspaceApp({ viewer }: WorkspaceAppProps) {
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);
  const [scopeElement, setScopeElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!scopeElement) return;

    NavigationService.init(scopeElement);
    return () => {
      NavigationService.cleanup();
    };
  }, [scopeElement]);

  useEffect(() => {
    const handleTaskOperationsSaved = (event: Event) => {
      const detail = (event as CustomEvent<TaskOperationsSavedDetail>).detail;
      if (!detail?.operationTypes?.length) return;

      void queryClient.invalidateQueries({ queryKey: timeReviewKey });
      void queryClient.invalidateQueries({ queryKey: progressSummaryKey });
    };

    window.addEventListener(TASK_OPERATIONS_SAVED_EVENT, handleTaskOperationsSaved);
    return () => {
      window.removeEventListener(TASK_OPERATIONS_SAVED_EVENT, handleTaskOperationsSaved);
    };
  }, [queryClient]);

  const handleScopeRef = useCallback((element: HTMLDivElement | null) => {
    setScopeElement(element);
  }, []);

  if (!isClient) {
    return <WorkspaceShellFallback />;
  }

  return (
    <div ref={handleScopeRef} data-scope>
      <BrowserRouter basename="/app">
        <Routes>
          <Route path="/" element={<MyWorkplaceComponent regionOrder={1} viewer={viewer} />} />
          <Route path="/workspace" element={<MyWorkplaceComponent regionOrder={1} viewer={viewer} />} />
          <Route path="/workspace/all-tasks" element={<MyWorkplaceComponent regionOrder={1} viewer={viewer} />} />
          <Route path="/workspace/today" element={<MyWorkplaceComponent regionOrder={1} dueDateFilter="today" viewer={viewer} />} />
          <Route path="/workspace/tomorrow" element={<MyWorkplaceComponent regionOrder={1} dueDateFilter="tomorrow" viewer={viewer} />} />
          <Route path="/workspace/this-week" element={<MyWorkplaceComponent regionOrder={1} dueDateFilter="this-week" viewer={viewer} />} />
          <Route path="/workspace/day-review" element={<ReviewWorkspaceComponent regionOrder={1} viewer={viewer} />} />
          <Route path="/workspace/day-recap" element={<DayRecapWorkspaceComponent regionOrder={1} viewer={viewer} />} />
          <Route path="/workspace/day-review/complete" element={<DayRecapWorkspaceComponent regionOrder={1} viewer={viewer} />} />
          <Route path="/workspace/review" element={<ReviewWorkspaceComponent regionOrder={1} viewer={viewer} />} />
          <Route path="/review/today" element={<ReviewWorkspaceComponent regionOrder={1} viewer={viewer} />} />
          <Route path="/workspace/progress" element={<ProgressWorkspaceComponent regionOrder={1} viewer={viewer} />} />
          <Route path="*" element={<MyWorkplaceComponent regionOrder={1} viewer={viewer} />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

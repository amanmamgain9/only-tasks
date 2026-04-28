"use client";

import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MyWorkplaceComponent from "./MyWorkplaceComponents/MyWorkplaceComponent";

function WorkspaceShellFallback() {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.12),rgba(255,255,255,0)),linear-gradient(135deg,#f8fafc_0%,#ffffff_48%,#f1f5f9_100%)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.18),rgba(0,0,0,0)),linear-gradient(135deg,#020617_0%,#0f172a_48%,#1e293b_100%)]">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="rounded-3xl border border-slate-200 bg-white/70 px-8 py-6 text-center shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading workspace...</p>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceApp() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <WorkspaceShellFallback />;
  }

  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route path="/" element={<Navigate to="/workspace/all-tasks" replace />} />
        <Route path="/workspace" element={<Navigate to="/workspace/all-tasks" replace />} />
        <Route path="/workspace/all-tasks" element={<MyWorkplaceComponent regionOrder={1} />} />
        <Route path="/workspace/today" element={<MyWorkplaceComponent regionOrder={1} dueDateFilter="today" />} />
        <Route path="/workspace/tomorrow" element={<MyWorkplaceComponent regionOrder={1} dueDateFilter="tomorrow" />} />
        <Route path="/workspace/this-week" element={<MyWorkplaceComponent regionOrder={1} dueDateFilter="this-week" />} />
        <Route path="*" element={<Navigate to="/workspace/all-tasks" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

"use client";

import React, { Suspense } from "react";
import type { AuthenticatedUser } from "@/server/auth";
import WorkspaceSidebar from "../WorkspaceSidebar";
import ProgressView from "./ProgressView";

interface ProgressWorkspaceComponentProps {
  regionOrder: number;
  viewer: AuthenticatedUser;
}

function ProgressSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="h-8 w-40 animate-pulse rounded-md bg-slate-200 dark:bg-white/10" />
      <div className="h-80 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

const ProgressWorkspaceComponent: React.FC<ProgressWorkspaceComponentProps> = ({ regionOrder, viewer }) => {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.12),rgba(255,255,255,0)),linear-gradient(135deg,#f8fafc_0%,#ffffff_48%,#f1f5f9_100%)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.18),rgba(0,0,0,0)),linear-gradient(135deg,#020617_0%,#0f172a_48%,#1e293b_100%)]">
      <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <WorkspaceSidebar regionOrder={regionOrder} viewer={viewer} />
        <div className="relative min-w-0 pb-24 lg:pb-0">
          <div data-region id="workspace-region" data-order={regionOrder + 1} className="px-4 py-5 sm:px-6 md:px-8">
            <div data-layout="vertical">
              <div data-order="0">
                <Suspense fallback={<ProgressSkeleton />}>
                  <ProgressView />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressWorkspaceComponent;

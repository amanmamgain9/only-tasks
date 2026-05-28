"use client";

import React, { Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import MyDayTasksComponent from "./MyWorkdayTasksComponent";
import WorkspaceSidebar from "../WorkspaceSidebar";
import type { AuthenticatedUser } from "@/server/auth";
import { useCurrentUserQuery } from "@/features/auth/hooks/useAuthQueries";

interface MyWorkplaceComponentProps {
  regionOrder: number;
  dueDateFilter?: "today" | "tomorrow" | "this-week";
  viewer?: AuthenticatedUser | null;
}

const SkeletonMyWorkplaceComponent = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
      <div className="animate-pulse">
        <div className="mb-6">
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-48" />
        </div>
        <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-80" />
      </div>
    </div>
  );
};

const MyWorkplaceComponent: React.FC<MyWorkplaceComponentProps> = ({ regionOrder, dueDateFilter, viewer }) => {
  const routerLocation = useLocation();
  const viewerQuery = useCurrentUserQuery<AuthenticatedUser>(!viewer);
  const resolvedViewer = viewer ?? viewerQuery.data ?? null;
  const isLoadingViewer = !viewer && viewerQuery.isLoading;

  useEffect(() => {
    if (!viewer && viewerQuery.isError) {
      window.location.href = `/sign-in?next=${encodeURIComponent(routerLocation.pathname || "/app")}`;
    }
  }, [routerLocation.pathname, viewer, viewerQuery.isError]);

  if (isLoadingViewer || !resolvedViewer) {
    return <SkeletonMyWorkplaceComponent />;
  }

  return (
    <div
      className="relative min-h-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.12),rgba(255,255,255,0)),linear-gradient(135deg,#f8fafc_0%,#ffffff_48%,#f1f5f9_100%)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.18),rgba(0,0,0,0)),linear-gradient(135deg,#020617_0%,#0f172a_48%,#1e293b_100%)]"
    >
      <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <WorkspaceSidebar regionOrder={regionOrder} dueDateFilter={dueDateFilter} viewer={resolvedViewer} />
        <div className="min-w-0">
          <div data-region id="workspace-region" data-order={regionOrder + 1} className="px-4 py-5 sm:px-6 md:px-8">
            <div data-layout="vertical">
              <div data-order="0">
                <MyDayTasksComponent dueDateFilter={dueDateFilter} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MyWorkplaceParentComponent: React.FC<MyWorkplaceComponentProps> = ({ regionOrder, dueDateFilter, viewer }) => {
  return (
    <Suspense fallback={<SkeletonMyWorkplaceComponent />}>
      <MyWorkplaceComponent regionOrder={regionOrder} dueDateFilter={dueDateFilter} viewer={viewer ?? null} />
    </Suspense>
  );
};

export default MyWorkplaceParentComponent;

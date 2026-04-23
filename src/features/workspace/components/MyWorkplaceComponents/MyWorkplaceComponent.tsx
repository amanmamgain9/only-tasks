"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import MyDayTasksComponent from "./MyWorkdayTasksComponent";
import WorkspaceSidebar from "../WorkspaceSidebar";
import { NavigationService } from "../../_services/navigationService";
import type { AuthenticatedUser } from "@/server/auth";

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
  const appRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [resolvedViewer, setResolvedViewer] = useState<AuthenticatedUser | null>(viewer ?? null);
  const [isLoadingViewer, setIsLoadingViewer] = useState(!viewer);

  useEffect(() => {
    if (!appRef.current) return;
    NavigationService.init(appRef.current);
    return () => {
      NavigationService.cleanup();
    };
  }, []);

  useEffect(() => {
    if (viewer) {
      setResolvedViewer(viewer);
      setIsLoadingViewer(false);
      return;
    }

    let cancelled = false;

    async function loadViewer() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.href = `/sign-in?next=${encodeURIComponent(pathname || "/")}`;
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load current user.");
        }

        const payload = (await response.json()) as { success: boolean; data?: AuthenticatedUser };
        if (!cancelled) {
          setResolvedViewer(payload.data ?? null);
        }
      } catch {
        if (!cancelled) {
          window.location.href = `/sign-in?next=${encodeURIComponent(pathname || "/")}`;
        }
      } finally {
        if (!cancelled) {
          setIsLoadingViewer(false);
        }
      }
    }

    void loadViewer();

    return () => {
      cancelled = true;
    };
  }, [pathname, viewer]);

  if (isLoadingViewer || !resolvedViewer) {
    return <SkeletonMyWorkplaceComponent />;
  }

  return (
    <div
      ref={appRef}
      data-scope
      className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]"
    >
      <div className="min-h-screen lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
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

"use client";

import React, { Suspense, useEffect, useRef } from "react";
import MyDayTasksComponent from "./MyWorkdayTasksComponent";
import WorkspaceSidebar from "../WorkspaceSidebar";
import { NavigationService } from "../../_services/navigationService";

interface MyWorkplaceComponentProps {
  regionOrder: number;
  dueDateFilter?: "today" | "tomorrow" | "this-week";
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

const MyWorkplaceComponent: React.FC<MyWorkplaceComponentProps> = ({ regionOrder, dueDateFilter }) => {
  const appRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appRef.current) return;
    NavigationService.init(appRef.current);
    return () => {
      NavigationService.cleanup();
    };
  }, []);

  return (
    <div
      ref={appRef}
      data-scope
      className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]"
    >
      <div className="min-h-screen lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
        <WorkspaceSidebar regionOrder={regionOrder} dueDateFilter={dueDateFilter} />
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

const MyWorkplaceParentComponent: React.FC<MyWorkplaceComponentProps> = ({ regionOrder, dueDateFilter }) => {
  return (
    <Suspense fallback={<SkeletonMyWorkplaceComponent />}>
      <MyWorkplaceComponent regionOrder={regionOrder} dueDateFilter={dueDateFilter} />
    </Suspense>
  );
};

export default MyWorkplaceParentComponent;

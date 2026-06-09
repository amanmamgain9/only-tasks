"use client";

import React, { Suspense } from "react";
import MyDayTasksComponent from "./MyWorkdayTasksComponent";
import type { AuthenticatedUser } from "@/server/auth";

interface MyWorkplaceComponentProps {
  regionOrder: number;
  dueDateFilter?: "today" | "tomorrow" | "this-week";
  surface?: "chat" | "all-tasks" | "tasks" | "day-review" | "progress";
  viewer: AuthenticatedUser;
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

const MyWorkplaceComponent: React.FC<MyWorkplaceComponentProps> = ({ regionOrder, dueDateFilter, surface = "chat", viewer }) => {
  return (
    <div
      className="relative min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white"
    >
      <div className="min-h-screen">
        <div className="relative min-w-0">
          <div data-region id="workspace-region" data-order={regionOrder} className="min-h-screen">
            <div data-layout="vertical" className="min-h-screen">
              <div data-order="0" className="min-h-screen">
                <MyDayTasksComponent dueDateFilter={dueDateFilter} surface={surface} viewer={viewer} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MyWorkplaceParentComponent: React.FC<MyWorkplaceComponentProps> = ({ regionOrder, dueDateFilter, surface, viewer }) => {
  return (
    <Suspense fallback={<SkeletonMyWorkplaceComponent />}>
      <MyWorkplaceComponent regionOrder={regionOrder} dueDateFilter={dueDateFilter} surface={surface} viewer={viewer} />
    </Suspense>
  );
};

export default MyWorkplaceParentComponent;

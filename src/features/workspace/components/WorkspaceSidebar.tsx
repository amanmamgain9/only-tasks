/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, type ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  ListTodo,
  LogOut,
  Sunrise,
} from "lucide-react";
import type { AuthenticatedUser } from "@/server/auth";
import ThemeToggle from "@/features/marketing/components/ThemeToggle";

type DueDateFilter = "today" | "tomorrow" | "this-week";

interface WorkspaceSidebarProps {
  regionOrder: number;
  dueDateFilter?: DueDateFilter;
  viewer: AuthenticatedUser;
}

const navItems: Array<{
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  filter?: DueDateFilter;
}> = [
  {
    href: "/workspace/all-tasks",
    label: "All Tasks",
    icon: ListTodo,
  },
  {
    href: "/workspace/today",
    label: "Today",
    icon: Calendar,
    filter: "today",
  },
  {
    href: "/workspace/tomorrow",
    label: "Tomorrow",
    icon: Sunrise,
    filter: "tomorrow",
  },
  {
    href: "/workspace/this-week",
    label: "This Week",
    icon: CalendarDays,
    filter: "this-week",
  },
];

function normalizePathname(pathname: string) {
  return pathname.startsWith("/app") ? pathname.slice(4) || "/" : pathname;
}

function isItemActive(pathname: string, href: string) {
  const normalizedPathname = normalizePathname(pathname);
  if (href === "/workspace/all-tasks") {
    return normalizedPathname === "/" || normalizedPathname === "/workspace" || normalizedPathname === "/workspace/all-tasks";
  }
  return normalizedPathname === href;
}

export default function WorkspaceSidebar({ regionOrder, viewer }: WorkspaceSidebarProps) {
  const [isWorkZoneOpen, setIsWorkZoneOpen] = useState(true);
  const location = useLocation();
  const pathname = location.pathname || "/";
  const isWorkZoneActive = navItems.some((item) => isItemActive(pathname, item.href));
  const initials =
    viewer.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || viewer.email.slice(0, 2).toUpperCase();

  return (
    <aside
      data-region
      id="sidebar-region"
      data-order={regionOrder}
      className="border-b border-border/40 bg-background/70 text-foreground backdrop-blur-xl lg:min-h-screen lg:border-b-0 lg:border-r"
    >
      <div data-layout="vertical" className="flex h-full flex-col p-3">
        <div data-order="0" className="px-2 pb-5 pt-3">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-full">
              <img src="/media/plan-my-workday/logo.jpg" alt="Plan My Workday Logo" className="h-full w-full object-cover" />
            </div>
            <span className="hidden font-semibold lg:block">PMWD</span>
            <span className="font-semibold lg:hidden">PlanMyWorkday</span>
          </div>
        </div>

        <div data-layout="vertical" data-order="1" className="min-w-0 flex-1">
          <div className="rounded-xl border border-border/40 bg-white/35 p-1 shadow-sm backdrop-blur dark:bg-slate-900/35">
            <button
              type="button"
              data-focusable
              data-entrypoint-focus
              data-order="1"
              aria-expanded={isWorkZoneOpen}
              onClick={() => setIsWorkZoneOpen((value) => !value)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-400/40 ${
                isWorkZoneActive ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/80"
              }`}
            >
              {isWorkZoneOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <FolderOpen className="h-4 w-4" />
              <span>Work Zone</span>
            </button>

            {isWorkZoneOpen && (
              <div data-layout="vertical" className="mt-1 border-l border-border/50 px-2 py-1">
                {navItems.map((item, index) => {
                  const Icon = item.icon;
                  const active = isItemActive(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      data-focusable
                      data-order={(index + 2).toString()}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-400/40 ${
                        active
                          ? "border border-indigo-500/20 bg-indigo-500/15 font-medium text-indigo-700 dark:text-indigo-300"
                          : "border border-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div data-order="2" className="mt-4 space-y-2">
          <div className="rounded-xl border border-border/40 bg-white/35 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur dark:bg-slate-900/35 dark:text-slate-400">
            <p className="font-medium text-slate-900 dark:text-slate-100">{viewer.subscription?.label || "Free"}</p>
            <p className="mt-0.5 truncate">{viewer.subscription?.status || "No subscription"}</p>
          </div>

          <div className="rounded-xl border border-border/40 bg-white/35 p-2 shadow-sm backdrop-blur dark:bg-slate-900/35">
            <div className="flex items-center justify-between px-1 py-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Theme</span>
              <ThemeToggle data-focusable data-order="6" className="h-8 w-8" />
            </div>
            <div className="flex items-center gap-2 px-1 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{viewer.name || viewer.email}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{viewer.email}</p>
              </div>
            </div>

            <form action="/api/auth/logout" method="post" className="mt-1">
              <button
                type="submit"
                data-focusable
                data-order="7"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 outline-none transition hover:bg-slate-100/80 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-400/40 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}

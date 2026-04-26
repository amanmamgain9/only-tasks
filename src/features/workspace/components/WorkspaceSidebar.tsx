"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, CalendarDays, ChevronRight, ListTodo, LogOut, PanelLeft, Sparkles, Sunrise } from "lucide-react";
import type { AuthenticatedUser } from "@/server/auth";

type DueDateFilter = "today" | "tomorrow" | "this-week";

interface WorkspaceSidebarProps {
  regionOrder: number;
  dueDateFilter?: DueDateFilter;
  viewer: AuthenticatedUser;
}

const navItems: Array<{
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  filter?: DueDateFilter;
}> = [
  {
    href: "/app",
    label: "All Tasks",
    description: "Everything in your current tree.",
    icon: ListTodo,
  },
  {
    href: "/app/today",
    label: "Today",
    description: "Tasks that should get handled today.",
    icon: Calendar,
    filter: "today",
  },
  {
    href: "/app/tomorrow",
    label: "Tomorrow",
    description: "Tomorrow's scheduled work.",
    icon: Sunrise,
    filter: "tomorrow",
  },
  {
    href: "/app/this-week",
    label: "This Week",
    description: "The week-level scheduling view.",
    icon: CalendarDays,
    filter: "this-week",
  },
];

function isItemActive(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === "/app" || pathname === "/app/all-tasks";
  }
  return pathname === href;
}

export default function WorkspaceSidebar({ regionOrder, dueDateFilter, viewer }: WorkspaceSidebarProps) {
  const pathname = usePathname() || "/";
  const initials =
    viewer.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || viewer.email.slice(0, 2).toUpperCase();
  const subscriptionTone = viewer.subscription?.isEntitled
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
    : viewer.subscription?.requiresBillingMigrationReview
      ? "border-amber-300/35 bg-amber-300/12 text-amber-100"
      : "border-slate-700 bg-slate-900/70 text-slate-300";

  return (
    <aside
      data-region
      id="sidebar-region"
      data-order={regionOrder}
      className="border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900 lg:border-b-0 lg:border-r lg:border-slate-200"
    >
      <div data-layout="vertical" className="relative flex h-full flex-col p-4 md:p-5">
        <div
          data-order="0"
          className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-slate-950 text-white shadow-[0_14px_36px_rgba(15,23,42,0.18)]">
              <PanelLeft className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">PlanMyWorkday</p>
              <h1 className="text-lg font-semibold text-slate-950">Work Zone</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            The old navigation shell is back in spirit: grouped date views, clear active state, and keyboard movement that still treats the sidebar as its own region.
          </p>
          <div className="mt-5 flex items-center justify-between rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Current Plan</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {viewer.subscription?.label || "Free"}
              </p>
            </div>
            <div
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${subscriptionTone}`}
            >
              {viewer.subscription?.status || "none"}
            </div>
          </div>
        </div>

        <div data-layout="vertical" data-order="1" className="mt-5">
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Work Zone</div>
            <div className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Tab to switch
            </div>
          </div>
          <div data-layout="vertical" className="space-y-1.5 rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const active = isItemActive(pathname, item.href);
              const currentView = dueDateFilter === item.filter;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-focusable
                  data-order={(index + 1).toString()}
                  className={`group block rounded-[1.15rem] border px-4 py-3 outline-none transition-all duration-200 focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400/30 ${
                    active
                      ? "border-indigo-200 bg-[linear-gradient(135deg,#eef2ff_0%,#e0e7ff_100%)] text-slate-950 shadow-[0_10px_30px_rgba(99,102,241,0.12)]"
                      : "border-transparent bg-transparent text-slate-900 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-[0.95rem] ${
                        active ? "bg-white text-indigo-600" : "bg-slate-100 text-slate-500 group-hover:bg-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.label}</span>
                        {currentView && (
                          <span className="rounded-full bg-indigo-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-700">
                            Active
                          </span>
                        )}
                      </div>
                      <p className={`mt-1 text-sm ${active ? "text-slate-700" : "text-slate-500"}`}>
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 ${active ? "text-indigo-500" : "text-slate-300"}`} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div
          data-order="2"
          className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.05)]"
        >
          <div className="flex items-center gap-2 text-slate-900">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Keyboard</p>
          </div>
          <p className="mt-2">
            Tab moves between the sidebar region and the workspace region. Inside a region, arrow keys still follow the preserved navigation tree.
          </p>
          {viewer.subscription?.note && (
            <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
              {viewer.subscription.note}
            </p>
          )}
        </div>

        <div
          data-order="3"
          className="mt-auto rounded-[1.6rem] border border-slate-200 bg-slate-950 p-4 text-slate-100 shadow-[0_24px_50px_rgba(15,23,42,0.18)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] bg-white/10 text-sm font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{viewer.name || viewer.email}</p>
              <p className="truncate text-xs text-slate-400">{viewer.email}</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post" className="mt-4">
            <button
              type="submit"
              data-focusable
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/40"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

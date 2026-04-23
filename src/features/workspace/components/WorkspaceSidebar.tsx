"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, CalendarDays, CheckSquare2, ListTodo, LogOut, Sparkles, Sunrise } from "lucide-react";
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
    href: "/",
    label: "All Tasks",
    description: "Everything in your current tree.",
    icon: ListTodo,
  },
  {
    href: "/today",
    label: "Today",
    description: "Tasks that should get handled today.",
    icon: Calendar,
    filter: "today",
  },
  {
    href: "/tomorrow",
    label: "Tomorrow",
    description: "Tomorrow's scheduled work.",
    icon: Sunrise,
    filter: "tomorrow",
  },
  {
    href: "/this-week",
    label: "This Week",
    description: "The week-level scheduling view.",
    icon: CalendarDays,
    filter: "this-week",
  },
];

function isItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname === "/all-tasks";
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
    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
    : viewer.subscription?.requiresBillingMigrationReview
      ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
      : "border-white/10 bg-white/5 text-stone-300";

  return (
    <aside
      data-region
      id="sidebar-region"
      data-order={regionOrder}
      className="border-b border-stone-200/80 bg-[linear-gradient(180deg,#171412_0%,#221c18_46%,#171412_100%)] text-stone-100 lg:border-b-0 lg:border-r lg:border-stone-800"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.12),transparent_24%)]"
        aria-hidden
      />
      <div data-layout="vertical" className="relative flex h-full flex-col p-4 md:p-5">
        <div
          data-order="0"
          className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-amber-300 text-stone-950 shadow-[0_14px_36px_rgba(252,211,77,0.28)]">
              <CheckSquare2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-stone-500">Only Tasks</p>
              <h1 className="text-lg font-semibold text-stone-50">Daily Control Room</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-stone-300">
            The sidebar is back as its own keyboard region, with route switching for the date views and user state wired into the same workspace shell.
          </p>
          <div className="mt-5 flex items-center justify-between rounded-[1.3rem] border border-white/10 bg-black/20 px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Current Plan</p>
              <p className="mt-1 text-sm font-medium text-stone-100">
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
          <div className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.24em] text-stone-500">
            Views
          </div>
          <div data-layout="vertical" className="space-y-2">
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
                  className={`group block rounded-[1.4rem] border px-4 py-3 outline-none transition-all duration-200 focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/40 ${
                    active
                      ? "border-amber-300/75 bg-[linear-gradient(135deg,#f9d45a_0%,#fbbf24_100%)] text-stone-950 shadow-[0_16px_40px_rgba(252,211,77,0.22)]"
                      : "border-white/10 bg-white/5 text-stone-100 hover:border-white/20 hover:bg-white/8"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-[1rem] ${
                        active ? "bg-stone-950/10" : "bg-white/8 group-hover:bg-white/12"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.label}</span>
                        {currentView && (
                          <span className="rounded-full bg-stone-950/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
                            Active
                          </span>
                        )}
                      </div>
                      <p className={`mt-1 text-sm ${active ? "text-stone-800" : "text-stone-400"}`}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div
          data-order="2"
          className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-stone-300"
        >
          <div className="flex items-center gap-2 text-stone-200">
            <Sparkles className="h-4 w-4 text-amber-200" />
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500">Keyboard</p>
          </div>
          <p className="mt-2">
            Tab moves between the sidebar region and the workspace region. Inside a region, arrow keys still follow the preserved navigation tree.
          </p>
          {viewer.subscription?.note && (
            <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-stone-300">
              {viewer.subscription.note}
            </p>
          )}
        </div>

        <div
          data-order="3"
          className="mt-auto rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] p-4 shadow-[0_24px_50px_rgba(0,0,0,0.22)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] bg-stone-100/10 text-sm font-semibold text-stone-50">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-100">{viewer.name || viewer.email}</p>
              <p className="truncate text-xs text-stone-400">{viewer.email}</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post" className="mt-4">
            <button
              type="submit"
              data-focusable
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-stone-100 transition hover:border-white/20 hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
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

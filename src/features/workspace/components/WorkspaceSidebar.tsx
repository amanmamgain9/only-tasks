"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Calendar,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  BarChart3,
  ListTodo,
  LogOut,
  Sunrise,
  UserRound,
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
  shortLabel?: string;
  icon: ComponentType<{ className?: string }>;
  filter?: DueDateFilter;
}> = [
  {
    href: "/workspace/all-tasks",
    label: "All Tasks",
    shortLabel: "Tasks",
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
    shortLabel: "Week",
    icon: CalendarDays,
    filter: "this-week",
  },
  {
    href: "/workspace/day-review",
    label: "Day Review",
    shortLabel: "Review",
    icon: CalendarCheck2,
  },
  {
    href: "/workspace/progress",
    label: "Progress",
    shortLabel: "Stats",
    icon: BarChart3,
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
  if (href === "/workspace/day-review") {
    return normalizedPathname === "/workspace/day-review" ||
      normalizedPathname === "/workspace/day-recap" ||
      normalizedPathname === "/workspace/day-review/complete" ||
      normalizedPathname === "/workspace/review" ||
      normalizedPathname === "/review/today";
  }
  return normalizedPathname === href;
}

export default function WorkspaceSidebar({ regionOrder, viewer }: WorkspaceSidebarProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [billingPortalError, setBillingPortalError] = useState<string | null>(null);
  const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const pathname = location.pathname || "/";
  const initials =
    viewer.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || viewer.email.slice(0, 2).toUpperCase();
  const subscriptionLabel = viewer.subscription?.label || "Free";
  const subscriptionStatus = viewer.subscription?.status || "inactive";

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function openBillingPortal() {
    setBillingPortalError(null);
    setIsOpeningBillingPortal(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
      });

      if (response.status === 401) {
        window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname || "/app")}`;
        return;
      }

      const payload = (await response.json()) as { success: boolean; data?: { url?: string }; error?: string };
      if (!response.ok || !payload.success || !payload.data?.url) {
        throw new Error(payload.error || "Could not open billing portal.");
      }

      window.location.href = payload.data.url;
    } catch (error) {
      setBillingPortalError(error instanceof Error ? error.message : "Could not open billing portal.");
    } finally {
      setIsOpeningBillingPortal(false);
    }
  }

  return (
    <>
      <aside
        data-region
        id="sidebar-region"
        data-order={regionOrder}
        className="hidden border-r border-slate-200 bg-slate-50/90 text-slate-950 backdrop-blur-xl dark:border-slate-900 dark:bg-slate-950 dark:text-white lg:block lg:min-h-screen"
      >
        <div data-layout="vertical" className="flex h-full flex-col px-3 py-4">
          <div data-order="0" className="px-1 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative size-9 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/10">
                <Image src="/media/plan-my-workday/logo.jpg" alt="Plan My Workday Logo" width={36} height={36} className="size-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-5">Plan My Workday</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">Workspace</p>
              </div>
            </div>
          </div>

          <nav data-layout="vertical" data-order="1" className="min-w-0 flex-1 space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const active = isItemActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  data-focusable
                  data-entrypoint-focus={index === 0 ? true : undefined}
                  data-order={(index + 1).toString()}
                  className={`group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                    active
                      ? "bg-slate-200/80 font-medium text-slate-950 dark:bg-white/10 dark:text-white"
                      : "text-slate-600 hover:bg-slate-200/55 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-slate-700 dark:text-slate-200" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"}`} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div data-order="2" ref={profileMenuRef} className="relative mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
            {isProfileMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 z-30 mb-2 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-900">
                <div className="px-2 py-2">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{viewer.name || viewer.email}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{viewer.email}</p>
                  <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
                    {subscriptionLabel} - {subscriptionStatus}
                  </p>
                </div>

                <a
                  href="/account"
                  data-focusable
                  data-order="30"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-300/60 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <UserRound className="size-4 text-slate-400" />
                  <span>Profile</span>
                </a>

                {viewer.subscription?.billingPortalAvailable && (
                  <button
                    type="button"
                    data-focusable
                    data-order="31"
                    onClick={openBillingPortal}
                    disabled={isOpeningBillingPortal}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 outline-none transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <CreditCard className="size-4 text-slate-400" />
                    <span>{isOpeningBillingPortal ? "Opening billing" : "Billing"}</span>
                  </button>
                )}

                {billingPortalError && <p className="px-2 py-1 text-[11px] leading-4 text-rose-600 dark:text-rose-300">{billingPortalError}</p>}

                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    data-focusable
                    data-order="32"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-300/60 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <LogOut className="size-4 text-slate-400" />
                    <span>Sign out</span>
                  </button>
                </form>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-focusable
                data-order="29"
                aria-expanded={isProfileMenuOpen}
                onClick={() => setIsProfileMenuOpen((value) => !value)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left outline-none transition hover:bg-slate-200/55 focus-visible:ring-2 focus-visible:ring-cyan-300/60 dark:hover:bg-white/10"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
                  {initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{viewer.name || viewer.email}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{viewer.email}</span>
                </span>
                <ChevronDown className={`size-4 shrink-0 text-slate-400 transition ${isProfileMenuOpen ? "rotate-180" : ""}`} />
              </button>

              <ThemeToggle data-focusable data-order="33" className="size-9 shrink-0 rounded-md border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-100 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15" />
            </div>
          </div>
        </div>
      </aside>

      <nav
        data-region
        id="mobile-nav-region"
        data-order={regionOrder}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 lg:hidden"
      >
        <div data-layout="horizontal" className="grid grid-cols-6 gap-1">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                to={item.href}
                data-focusable
                data-order={(index + 1).toString()}
                className={`flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                  active
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="w-full truncate text-center leading-none">{item.shortLabel ?? item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

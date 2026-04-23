"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, CalendarDays, CheckSquare2, ListTodo, Sunrise } from "lucide-react";

type DueDateFilter = "today" | "tomorrow" | "this-week";

interface WorkspaceSidebarProps {
  regionOrder: number;
  dueDateFilter?: DueDateFilter;
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

export default function WorkspaceSidebar({ regionOrder, dueDateFilter }: WorkspaceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      data-region
      id="sidebar-region"
      data-order={regionOrder}
      className="border-b border-stone-200/80 bg-stone-950 text-stone-100 lg:border-b-0 lg:border-r lg:border-stone-800"
    >
      <div data-layout="vertical" className="flex h-full flex-col p-4 md:p-5">
        <div
          data-order="0"
          className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300 text-stone-950 shadow-[0_12px_36px_rgba(252,211,77,0.28)]">
              <CheckSquare2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-stone-500">Only Tasks</p>
              <h1 className="text-lg font-semibold text-stone-50">Work Zone</h1>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-300">
            Sidebar navigation is back as its own keyboard region, so Tab can move here first and then into the task tree.
          </p>
        </div>

        <div data-layout="vertical" data-order="1" className="mt-5">
          <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500">
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
                  className={`group block rounded-2xl border px-4 py-3 outline-none transition-all focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/40 ${
                    active
                      ? "border-amber-300/70 bg-amber-300 text-stone-950 shadow-[0_14px_36px_rgba(252,211,77,0.28)]"
                      : "border-white/10 bg-white/5 text-stone-100 hover:border-white/20 hover:bg-white/8"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
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
          className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-stone-300"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500">Keyboard</p>
          <p className="mt-2">
            Tab moves between the sidebar region and the workspace region. Inside a region, arrow keys still follow the preserved navigation tree.
          </p>
        </div>
      </div>
    </aside>
  );
}

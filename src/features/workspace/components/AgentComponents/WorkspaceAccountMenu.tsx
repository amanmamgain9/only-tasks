"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, CreditCard, LogOut, UserRound } from "lucide-react";
import type { AuthenticatedUser } from "@/server/auth";
import ThemeToggle from "@/features/marketing/components/ThemeToggle";

export default function WorkspaceAccountMenu({ viewer }: { viewer: AuthenticatedUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [billingPortalError, setBillingPortalError] = useState<string | null>(null);
  const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
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
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

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
    <div ref={menuRef} className="relative flex items-center gap-2">
      <ThemeToggle
        data-focusable
        data-tab-consume
        data-order="41"
        className="size-9 shrink-0 rounded-lg border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-100 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
      />
      <button
        ref={triggerRef}
        type="button"
        data-focusable
        data-tab-consume
        data-order="42"
        aria-expanded={isOpen}
        aria-label="Account menu"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex h-9 max-w-[14rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-left text-slate-700 shadow-sm outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-950 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-950">
          {initials}
        </span>
        <span className="hidden min-w-0 text-xs font-medium sm:block">
          <span className="block truncate">{viewer.name || viewer.email}</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div
          data-layout="vertical"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-900"
        >
          <div data-order="0" className="px-2 py-2">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{viewer.name || viewer.email}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{viewer.email}</p>
            <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
              {subscriptionLabel} - {subscriptionStatus}
            </p>
          </div>

          <a
            href="/account"
            data-focusable
            data-tab-consume
            data-order="1"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-300/60 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <UserRound className="size-4 text-slate-400" />
            <span>Profile</span>
          </a>

          {viewer.subscription?.billingPortalAvailable ? (
            <button
              type="button"
              data-focusable
              data-tab-consume
              data-order="2"
              onClick={openBillingPortal}
              disabled={isOpeningBillingPortal}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 outline-none transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <CreditCard className="size-4 text-slate-400" />
              <span>{isOpeningBillingPortal ? "Opening billing" : "Billing"}</span>
            </button>
          ) : null}

          {billingPortalError ? (
            <p data-order="3" className="px-2 py-1 text-[11px] leading-4 text-rose-600 dark:text-rose-300">{billingPortalError}</p>
          ) : null}

          <form data-order="4" action="/api/auth/logout" method="post">
            <button
              type="submit"
              data-focusable
              data-tab-consume
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-300/60 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <LogOut className="size-4 text-slate-400" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

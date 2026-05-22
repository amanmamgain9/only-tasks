"use client";

import { useState } from "react";
import Script from "next/script";
import { ArrowRight, CreditCard } from "lucide-react";
import type { PaddlePlanKey } from "@/server/billing/plans";

type PaddleCheckoutOptions = {
  settings: {
    displayMode: "overlay";
    successUrl: string;
    variant?: "one-page" | "multi-page";
    theme?: "light" | "dark";
  };
  items: Array<{
    priceId: string;
    quantity: number;
  }>;
  customer:
    | {
        id: string;
      }
    | {
        email: string;
      };
  customData: Record<string, string | number | boolean>;
};

type PlanCard = {
  planKey: PaddlePlanKey;
  label: string;
  checkoutLabel: string;
  priceLabel: string;
  description: string;
  trialDays: number;
  configured: boolean;
};

type CheckoutResponse = {
  success: boolean;
  error?: string;
  code?: string;
  data?:
    | {
        kind: "subscription_updated";
        action?: string;
        message?: string;
      }
    | {
        checkout: PaddleCheckoutOptions;
        environment: "sandbox" | "production";
      };
};

type PaddleEvent = {
  name?: string;
  code?: string;
  detail?: string;
  documentation_url?: string;
};

declare global {
  interface Window {
    Paddle?: {
      Environment?: {
        set(environment: "sandbox" | "production"): void;
      };
      Initialize(config: {
        token: string;
        checkout?: {
          settings?: Record<string, unknown>;
        };
        eventCallback?: (event: PaddleEvent) => void;
      }): void;
      Update?(config: {
        eventCallback?: (event: PaddleEvent) => void;
      }): void;
      Checkout?: {
        open(options: PaddleCheckoutOptions): void;
      };
    };
    __pmwdPaddleInitialized?: boolean;
    __pmwdPaddleEventHandler?: (event: PaddleEvent) => void;
  }
}

const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";

function getCheckoutTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function formatPaddleError(event: PaddleEvent) {
  const code = event.code ? ` (${event.code})` : "";
  return event.detail ? `${event.detail}${code}` : `Paddle checkout failed${code}.`;
}

function initializePaddle(environment: "sandbox" | "production") {
  if (!PADDLE_CLIENT_TOKEN) {
    throw new Error("Paddle checkout is not configured.");
  }
  if (!window.Paddle?.Initialize || !window.Paddle.Checkout?.open) {
    throw new Error("Paddle.js is still loading. Try again in a moment.");
  }
  if (window.__pmwdPaddleInitialized) return;

  if (environment === "sandbox") {
    window.Paddle.Environment?.set("sandbox");
  }

  const eventCallback = (event: PaddleEvent) => {
    window.__pmwdPaddleEventHandler?.(event);
  };

  if (window.__pmwdPaddleInitialized) {
    window.Paddle.Update?.({ eventCallback });
    return;
  }

  window.Paddle.Initialize({
    token: PADDLE_CLIENT_TOKEN,
    checkout: {
      settings: {
        displayMode: "overlay",
      },
    },
    eventCallback,
  });
  window.__pmwdPaddleInitialized = true;
}

export default function PaddleCheckoutButtons({ plans }: { plans: PlanCard[] }) {
  const [busyPlan, setBusyPlan] = useState<PaddlePlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(planKey: PaddlePlanKey) {
    setBusyPlan(planKey);
    setError(null);

    try {
      window.__pmwdPaddleEventHandler = (event) => {
        if (event.name !== "checkout.error") return;
        console.error("Paddle checkout error", event);
        setError(formatPaddleError(event));
      };

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ plan: planKey }),
      });

      if (response.status === 401) {
        window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname || "/pricing")}`;
        return;
      }

      const payload = (await response.json()) as CheckoutResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "Could not start checkout.");
      }

      if ("kind" in payload.data && payload.data.kind === "subscription_updated") {
        setError(payload.data.message || "Subscription updated.");
        window.location.href = "/app/workspace/all-tasks";
        return;
      }

      if (!("checkout" in payload.data)) {
        throw new Error("Checkout details were not returned.");
      }

      initializePaddle(payload.data.environment);
      window.Paddle?.Checkout?.open({
        ...payload.data.checkout,
        settings: {
          ...payload.data.checkout.settings,
          theme: getCheckoutTheme(),
        },
      });
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not start checkout.");
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <>
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="afterInteractive" />
      <div className="grid gap-5 lg:grid-cols-2">
        {plans.map((plan) => (
          <div
            key={plan.planKey}
            className={`relative overflow-hidden rounded-3xl border bg-white/75 p-7 shadow-xl backdrop-blur-xl dark:bg-slate-900/60 ${
              plan.planKey === "pro_monthly"
                ? "border-indigo-500/50 dark:border-indigo-400/50"
                : "border-slate-200/70 dark:border-slate-700/70"
            }`}
          >
            {plan.planKey === "pro_monthly" && plan.trialDays > 0 && (
              <div className="absolute right-5 top-5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                {plan.trialDays}-day trial
              </div>
            )}

            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-purple-700 text-white shadow-lg">
              <CreditCard className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">{plan.label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{plan.description}</p>
            <div className="mt-7 flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">{plan.priceLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => startCheckout(plan.planKey)}
              disabled={!plan.configured || busyPlan !== null}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyPlan === plan.planKey ? "Opening checkout..." : plan.checkoutLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            {!plan.configured && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Price ID missing in environment.</p>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}
    </>
  );
}

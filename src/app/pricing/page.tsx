import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Keyboard, ShieldCheck, Zap } from "lucide-react";
import PaddleCheckoutButtons from "@/features/billing/components/PaddleCheckoutButtons";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";
import { listPaddlePlanConfigs } from "@/server/billing/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Plan My Workday pricing with monthly billing and lifetime access.",
};

export default function PricingPage() {
  const plans = listPaddlePlanConfigs().map(({ planKey, label, checkoutLabel, priceLabel, description, trialDays, priceId }) => ({
    planKey,
    label,
    checkoutLabel,
    priceLabel,
    description,
    trialDays,
    configured: Boolean(priceId),
  }));
  const trialDays = plans.find((plan) => plan.planKey === "pro_monthly")?.trialDays ?? 3;

  return (
    <main className="relative min-h-screen text-slate-950 dark:text-white">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.2),rgba(0,0,0,0))]" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <section className="py-16 text-center sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-300">Pricing</p>
          <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-6xl">
            One focused workspace. Monthly or lifetime.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            {trialDays > 0
              ? `Monthly can start with a ${trialDays}-day free trial. Lifetime is a single upfront payment.`
              : "Monthly starts paid access immediately. Lifetime is a single upfront payment."}
          </p>
        </section>

        <section className="mx-auto w-full max-w-5xl pb-16">
          <PaddleCheckoutButtons plans={plans} />
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-4 pb-16 md:grid-cols-3">
          {[
            {
              icon: Keyboard,
              title: "Keyboard-first",
              text: "The task tree and workspace navigation stay built around speed.",
            },
            {
              icon: Zap,
              title: "No plan sprawl",
              text: "Monthly Pro or lifetime access. No multi-product billing baggage.",
            },
            {
              icon: ShieldCheck,
              title: "Secure checkout",
              text: "Checkout, receipts, cards, taxes, and subscription management are handled securely.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-lg backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/50">
                <Icon className="size-6 text-indigo-600 dark:text-indigo-300" />
                <h2 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.text}</p>
              </div>
            );
          })}
        </section>

        <section className="mx-auto mb-16 w-full max-w-5xl rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-lg backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/50">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              "Cancel monthly any time before your next renewal.",
              "Keep every project, task, and date view in one focused workspace.",
              "Switch from monthly to lifetime whenever lifetime access is available.",
              "Secure checkout includes receipts, card updates, and tax handling.",
            ].map((point) => (
              <div key={point} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{point}</p>
              </div>
            ))}
          </div>
          <Link href="/app/workspace/all-tasks" className="mt-6 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300">
            Go to workspace
          </Link>
        </section>

        <MarketingFooter />
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />
        <section className="flex-1 py-12">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">About</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">PlanMyWorkday is back to being one product.</h1>
            <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
              <p>
                This rebuild pulls the task-management core out of the older multi-surface setup and puts it into one focused Next.js application. The task tree, date views, keyboard navigation, auth, and subscription state now live together.
              </p>
              <p>
                The goal is simple: keep the hard-won workflow speed, remove product sprawl, and let the public site and the app coexist without fighting each other for routes or context.
              </p>
            </div>
          </div>
        </section>
        <MarketingFooter />
      </div>
    </main>
  );
}

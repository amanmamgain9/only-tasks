import type { Metadata } from "next";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";

export const metadata: Metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />
        <section className="flex-1 py-12">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">Terms</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">Terms of service</h1>
            <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
              <p>PlanMyWorkday provides task-management software and related account services. You are responsible for the content you enter into your workspace and for maintaining access to your account credentials.</p>
              <p>Subscription access, if applicable, is governed by the plan attached to your account. During the current rebuild, some legacy subscriptions may be marked for migration review before billing is fully moved to Paddle.</p>
              <p>We may change the product, pricing, or infrastructure as the service evolves. Continued use of the app means you accept those updates.</p>
            </div>
          </div>
        </section>
        <MarketingFooter />
      </div>
    </main>
  );
}

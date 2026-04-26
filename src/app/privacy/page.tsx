import type { Metadata } from "next";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />
        <section className="flex-1 py-12">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">Privacy</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">Privacy notice</h1>
            <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
              <p>We store the minimum account data needed to run the product: identity, session state, task/workspace records, and subscription state.</p>
              <p>For Google sign-in, we use the profile details returned by Google to create or update your account. For billing, legacy subscription records were migrated into this app and will be used to support the move to Paddle.</p>
              <p>If you need your data reviewed or removed, contact support at planmyworkday@gmail.com.</p>
            </div>
          </div>
        </section>
        <MarketingFooter />
      </div>
    </main>
  );
}

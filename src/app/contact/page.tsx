import type { Metadata } from "next";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />
        <section className="flex-1 py-12">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">Contact</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">Reach the team.</h1>
            <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
              <p>
                For support, billing questions, or migration issues, contact
                {" "}
                <a href="mailto:planmyworkday@gmail.com" className="font-medium text-indigo-600 underline-offset-4 hover:underline">
                  planmyworkday@gmail.com
                </a>
                .
              </p>
              <p>
                If you were migrated from the older system and your subscription still needs review before the Paddle move, mention your account email and we can trace the imported record directly.
              </p>
            </div>
          </div>
        </section>
        <MarketingFooter />
      </div>
    </main>
  );
}

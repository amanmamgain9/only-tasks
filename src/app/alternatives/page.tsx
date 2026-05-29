import Link from "next/link";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";
import { marketingAlternatives } from "@/features/marketing/seo-page-data";
import { buildMarketingMetadata } from "@/features/marketing/seo";

export const metadata = buildMarketingMetadata({
  title: "Plan My Workday Alternatives | Productivity Tools Comparison",
  description:
    "Compare Plan My Workday with other productivity tools and see why a focused task-planning workspace can beat broad all-in-one apps for daily execution.",
  path: "/alternatives",
  keywords: ["Plan My Workday alternatives", "Notion alternative", "task management comparison", "daily planning app"],
});

export default function AlternativesPage() {
  return (
    <main className="relative min-h-screen text-slate-950 dark:text-white">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.2),rgba(0,0,0,0))]" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <section className="py-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">Alternatives</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Built for keyboard-speed planning.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Plan My Workday is focused on fast nested tasks, date views, and focused execution instead of broad project-management ceremony.
          </p>
        </section>

        <section className="grid gap-6 pb-16 md:grid-cols-2">
          {marketingAlternatives.map((alternative) => (
            <Link
              key={alternative.slug}
              href={`/alternatives/${alternative.slug}`}
              className="group rounded-[1.8rem] border border-slate-200 bg-white/85 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)] dark:border-slate-700 dark:bg-slate-800/55"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">{alternative.category}</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{alternative.title}</h2>
              <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">{alternative.description}</p>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                {alternative.userProblem}
              </div>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">
                Compare
                <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                  -&gt;
                </span>
              </span>
            </Link>
          ))}
        </section>

        <MarketingFooter />
      </div>
    </main>
  );
}

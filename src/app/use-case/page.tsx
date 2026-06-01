import Image from "next/image";
import Link from "next/link";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";
import { marketingUseCases } from "@/features/marketing/seo-page-data";
import { buildMarketingMetadata } from "@/features/marketing/seo";

export const metadata = buildMarketingMetadata({
  title: "Use Cases | Plan My Workday",
  description:
    "Discover how Plan My Workday helps ADHD users, freelancers, students, and professionals plan flexible workdays with nested tasks and date views.",
  path: "/use-case",
  keywords: ["ADHD productivity", "daily planning use cases", "freelancer task planning", "student productivity"],
});

export default function UseCasePage() {
  return (
    <main className="relative min-h-screen text-slate-950 dark:text-white">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.2),rgba(0,0,0,0))]" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <section className="py-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">Use Cases</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            For people whose workday changes fast.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Use Plan My Workday to capture messy work, break it into nested tasks, and switch between all work and date-focused views.
          </p>
        </section>

        <section className="grid gap-6 pb-16">
          {marketingUseCases.map((useCase) => (
            <Link
              key={useCase.slug}
              href={`/use-case/${useCase.slug}`}
              className="group grid gap-6 rounded-[1.8rem] border border-slate-200 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)] dark:border-slate-700 dark:bg-slate-800/55 md:grid-cols-[260px_minmax(0,1fr)] md:p-6"
            >
              <div className="relative min-h-48 overflow-hidden rounded-[1.3rem] border border-slate-200 bg-slate-100">
                <Image src={useCase.image} alt={useCase.name} fill sizes="(max-width: 768px) 100vw, 260px" className="object-cover transition duration-300 group-hover:scale-[1.02]" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{useCase.name}</h2>
                <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">{useCase.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">
                  Read use case
                  <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                    -&gt;
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </section>

        <MarketingFooter />
      </div>
    </main>
  );
}

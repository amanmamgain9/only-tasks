import Image from "next/image";
import Link from "next/link";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";
import { marketingFeatures } from "@/features/marketing/seo-page-data";
import { buildMarketingMetadata } from "@/features/marketing/seo";

export const metadata = buildMarketingMetadata({
  title: "Features | Plan My Workday",
  description:
    "Discover Plan My Workday features for keyboard-first task management, nested task planning, date views, and focused execution.",
  path: "/features",
  keywords: [
    "Plan My Workday features",
    "keyboard first task management",
    "nested task planning",
    "daily planning app",
  ],
});

export default function FeaturesPage() {
  return (
    <main className="relative min-h-screen text-slate-950 dark:text-white">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.2),rgba(0,0,0,0))]" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <section className="py-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">Features</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Task management as fast as your brain.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Plan My Workday keeps the fast task tree, keyboard movement, date views, and focus timer in one workspace.
          </p>
        </section>

        <section className="grid gap-6 pb-16 md:grid-cols-2">
          {marketingFeatures.map((feature) => (
            <Link
              key={feature.slug}
              href={`/features/${feature.slug}`}
              className="group overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white/85 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)] dark:border-slate-700 dark:bg-slate-800/55"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                <Image src={feature.image} alt={feature.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition duration-300 group-hover:scale-[1.02]" />
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{feature.name}</h2>
                <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">{feature.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">
                  Learn more
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

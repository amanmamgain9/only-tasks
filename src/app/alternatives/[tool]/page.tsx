import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";
import {
  getMarketingAlternative,
  marketingAlternatives,
} from "@/features/marketing/seo-page-data";
import { absoluteUrl, buildMarketingMetadata } from "@/features/marketing/seo";

export const dynamic = "force-static";

export function generateStaticParams() {
  return marketingAlternatives.map((alternative) => ({ tool: alternative.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  const alternative = getMarketingAlternative(tool);

  if (!alternative) {
    return buildMarketingMetadata({
      title: "Alternative Not Found | Plan My Workday",
      description: "The requested Plan My Workday comparison could not be found.",
      path: "/alternatives",
    });
  }

  return buildMarketingMetadata({
    title: alternative.title,
    description: alternative.description,
    path: `/alternatives/${alternative.slug}`,
    keywords: [
      alternative.title,
      "Plan My Workday alternative",
      `${alternative.name} alternative`,
      "task management comparison",
    ],
    type: "article",
  });
}

function buildAlternativeSchema(alternative: NonNullable<ReturnType<typeof getMarketingAlternative>>) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: alternative.title,
    description: alternative.description,
    author: {
      "@type": "Organization",
      name: "Plan My Workday",
    },
    publisher: {
      "@type": "Organization",
      name: "Plan My Workday",
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/media/plan-my-workday/logo.jpg"),
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(`/alternatives/${alternative.slug}`),
    },
  };
}

export default async function AlternativeDetailPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  const alternative = getMarketingAlternative(tool);

  if (!alternative) {
    notFound();
  }

  const schema = buildAlternativeSchema(alternative);

  return (
    <main className="relative min-h-screen text-slate-950 dark:text-white">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.2),rgba(0,0,0,0))]" />

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <article className="pb-16 pt-10">
          <Link href="/alternatives" className="text-sm font-semibold text-indigo-600 hover:underline">
            &lt;- Alternatives
          </Link>

          <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-700 dark:bg-slate-800/55 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">{alternative.category}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">{alternative.title}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">{alternative.description}</p>

            <section className="mt-10 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/50">
              <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">The planning problem</h2>
              <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">{alternative.userProblem}</p>
            </section>

            <section className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-950/40">
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{alternative.name}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{alternative.alternativeSolution}</p>
              </div>
              <div className="rounded-[1.5rem] border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Plan My Workday</h2>
                <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-200">{alternative.planMyWorkdaySolution}</p>
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Feature comparison</h2>
              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-3 bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <div className="p-4">Area</div>
                  <div className="border-l border-slate-200 p-4 dark:border-slate-700">{alternative.name}</div>
                  <div className="border-l border-slate-200 p-4 dark:border-slate-700">Plan My Workday</div>
                </div>
                {alternative.features.map((row) => (
                  <div key={row.feature} className="grid grid-cols-1 border-t border-slate-200 text-sm leading-6 dark:border-slate-700 md:grid-cols-3">
                    <div className="bg-slate-50 p-4 font-semibold text-slate-900 dark:bg-slate-900/50 dark:text-white">{row.feature}</div>
                    <div className="border-t border-slate-200 p-4 text-slate-600 dark:border-slate-700 dark:text-slate-300 md:border-l md:border-t-0">{row.alternative}</div>
                    <div className="border-t border-slate-200 p-4 text-slate-700 dark:border-slate-700 dark:text-slate-200 md:border-l md:border-t-0">{row.planMyWorkday}</div>
                  </div>
                ))}
                <div className="grid grid-cols-1 border-t border-slate-200 text-sm leading-6 dark:border-slate-700 md:grid-cols-3">
                  <div className="bg-slate-50 p-4 font-semibold text-slate-900 dark:bg-slate-900/50 dark:text-white">Pricing</div>
                  <div className="border-t border-slate-200 p-4 text-slate-600 dark:border-slate-700 dark:text-slate-300 md:border-l md:border-t-0">{alternative.pricing.alternative}</div>
                  <div className="border-t border-slate-200 p-4 text-slate-700 dark:border-slate-700 dark:text-slate-200 md:border-l md:border-t-0">{alternative.pricing.planMyWorkday}</div>
                </div>
              </div>
            </section>
          </div>
        </article>

        <MarketingFooter />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </main>
  );
}

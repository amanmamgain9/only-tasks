import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";
import {
  getMarketingFeature,
  marketingFeatures,
} from "@/features/marketing/seo-page-data";
import { absoluteUrl, buildMarketingMetadata } from "@/features/marketing/seo";

export const dynamic = "force-static";

export function generateStaticParams() {
  return marketingFeatures.map((feature) => ({ feature: feature.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  const featureData = getMarketingFeature(feature);

  if (!featureData) {
    return buildMarketingMetadata({
      title: "Feature Not Found | Plan My Workday",
      description: "The requested Plan My Workday feature could not be found.",
      path: "/features",
    });
  }

  return buildMarketingMetadata({
    title: featureData.title,
    description: featureData.description,
    path: `/features/${featureData.slug}`,
    image: featureData.image,
    keywords: [
      featureData.name,
      "Plan My Workday feature",
      "task management feature",
      "daily planning feature",
    ],
    type: "article",
  });
}

function buildFeatureSchema(feature: NonNullable<ReturnType<typeof getMarketingFeature>>) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: feature.title,
    description: feature.description,
    image: absoluteUrl(feature.image),
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
      "@id": absoluteUrl(`/features/${feature.slug}`),
    },
  };
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  const featureData = getMarketingFeature(feature);

  if (!featureData) {
    notFound();
  }

  const schema = buildFeatureSchema(featureData);

  return (
    <main className="relative min-h-screen text-slate-950 dark:text-white">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.2),rgba(0,0,0,0))]" />

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <article className="pb-16 pt-10">
          <Link href="/features" className="text-sm font-semibold text-indigo-600 hover:underline">
            &lt;- Features
          </Link>

          <div className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white/85 shadow-[0_20px_50px_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-700 dark:bg-slate-800/55">
            <div className="relative aspect-[16/9] bg-slate-100">
              <Image src={featureData.image} alt={featureData.name} fill priority sizes="(max-width: 1024px) 100vw, 1024px" className="object-cover" />
            </div>

            <div className="p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">{featureData.name}</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">{featureData.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">{featureData.description}</p>

              <section className="mt-10">
                <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">About this feature</h2>
                <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">{featureData.details}</p>
              </section>

              <section className="mt-10">
                <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Key benefits</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {featureData.benefits.map((benefit) => (
                    <div key={benefit} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                      {benefit}
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-10">
                <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">How it works</h2>
                <div className="mt-5 grid gap-4">
                  {featureData.howItWorks.map((step, index) => (
                    <div key={step.title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950/40">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Step {index + 1}</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              <blockquote className="mt-10 rounded-[1.5rem] border border-indigo-200 bg-indigo-50 p-6 text-base leading-8 text-slate-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-slate-200">
                <p>&quot;{featureData.testimonial.quote}&quot;</p>
                <footer className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">
                  {featureData.testimonial.author}, {featureData.testimonial.role}
                </footer>
              </blockquote>
            </div>
          </div>
        </article>

        <MarketingFooter />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";
import {
  getMarketingUseCase,
  marketingUseCases,
} from "@/features/marketing/seo-page-data";
import { absoluteUrl, buildMarketingMetadata } from "@/features/marketing/seo";

export const dynamic = "force-static";

export function generateStaticParams() {
  return marketingUseCases.map((useCase) => ({ persona: useCase.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  const useCase = getMarketingUseCase(persona);

  if (!useCase) {
    return buildMarketingMetadata({
      title: "Use Case Not Found | Plan My Workday",
      description: "The requested Plan My Workday use case could not be found.",
      path: "/use-case",
    });
  }

  return buildMarketingMetadata({
    title: useCase.title,
    description: useCase.description,
    path: `/use-case/${useCase.slug}`,
    image: useCase.image,
    keywords: [
      `productivity for ${useCase.name}`,
      "ADHD productivity",
      "Plan My Workday use case",
      "daily planning",
    ],
    type: "article",
  });
}

function buildUseCaseSchema(useCase: NonNullable<ReturnType<typeof getMarketingUseCase>>) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: useCase.title,
    description: useCase.description,
    image: absoluteUrl(useCase.image),
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
      "@id": absoluteUrl(`/use-case/${useCase.slug}`),
    },
  };
}

function buildFaqSchema(useCase: NonNullable<ReturnType<typeof getMarketingUseCase>>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: useCase.faqQuestions.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export default async function UseCaseDetailPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  const useCase = getMarketingUseCase(persona);

  if (!useCase) {
    notFound();
  }

  const schemas = [buildUseCaseSchema(useCase), buildFaqSchema(useCase)];

  return (
    <main className="relative min-h-screen text-slate-950 dark:text-white">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.2),rgba(0,0,0,0))]" />

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <article className="pb-16 pt-10">
          <Link href="/use-case" className="text-sm font-semibold text-indigo-600 hover:underline">
            &lt;- Use cases
          </Link>

          <div className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white/85 shadow-[0_20px_50px_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-700 dark:bg-slate-800/55">
            <div className="relative aspect-[16/9] bg-slate-100">
              <Image src={useCase.image} alt={useCase.name} fill priority sizes="(max-width: 1024px) 100vw, 1024px" className="object-cover" />
            </div>

            <div className="p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">{useCase.name}</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">{useCase.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">{useCase.description}</p>

              <section className="mt-10 grid gap-6 md:grid-cols-2">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Common challenges</h2>
                  <div className="mt-5 grid gap-3">
                    {useCase.challenges.map((challenge) => (
                      <div key={challenge} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                        {challenge}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">How it helps</h2>
                  <div className="mt-5 grid gap-3">
                    {useCase.benefits.map((benefit) => (
                      <div key={benefit} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-slate-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-slate-200">
                        {benefit}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="mt-10">
                <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Best-fit features</h2>
                <div className="mt-5 grid gap-4">
                  {useCase.features.map((feature) => (
                    <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950/40">
                      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-10">
                <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">FAQ</h2>
                <div className="mt-5 grid gap-4">
                  {useCase.faqQuestions.map((faq) => (
                    <div key={faq.question} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/50">
                      <h3 className="text-base font-semibold text-slate-950 dark:text-white">{faq.question}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </article>

        <MarketingFooter />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }} />
    </main>
  );
}

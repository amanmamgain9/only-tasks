import Link from "next/link";
import MarketingFooter from "./MarketingFooter";
import MarketingHeader from "./MarketingHeader";

interface SimpleMarketingPageProps {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
}

export default function SimpleMarketingPage({ eyebrow, title, description, points }: SimpleMarketingPageProps) {
  return (
    <main className="relative min-h-screen text-slate-950">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))]" />

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />
        <section className="flex flex-1 items-center py-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">{eyebrow}</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-bold tracking-normal text-slate-950 sm:text-6xl">{title}</h1>
            <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-600">{description}</p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {points.map((point) => (
                <div key={point} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-base font-medium leading-7 text-slate-800">{point}</p>
                </div>
              ))}
            </div>
            <Link
              href="/app/workspace/all-tasks"
              className="mt-10 inline-flex rounded-2xl bg-gradient-to-r from-indigo-500 via-blue-600 to-purple-700 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:from-indigo-600 hover:via-blue-700 hover:to-purple-800"
            >
              Try it free
            </Link>
          </div>
        </section>
        <MarketingFooter />
      </div>
    </main>
  );
}

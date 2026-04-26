import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckSquare2, Keyboard, Layers3, Sunrise } from "lucide-react";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";

const featureCards = [
  {
    title: "Keyboard First",
    description: "The old navigation battles stay won: sidebar, task tree, and modal scopes still move like a real desktop app.",
    icon: Keyboard,
  },
  {
    title: "Nested Task Trees",
    description: "Projects, roots, subtasks, ordering, and due dates still live in the same fast tree editor.",
    icon: Layers3,
  },
  {
    title: "Date Views",
    description: "Switch between All Tasks, Today, Tomorrow, and This Week without leaving the same workspace shell.",
    icon: CalendarDays,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">PlanMyWorkday</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              Focused task management with the original keyboard edge intact.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              The task engine now lives in one Next.js app. Public content stays at the root, the migrated workspace lives under
              {" "}
              <span className="font-semibold text-slate-900">/app</span>
              , and the old blog and product story are coming back around it.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/app"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open App
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/blog"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Read the Blog
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {featureCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-950">{card.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-8 top-10 hidden h-28 w-28 rounded-full bg-indigo-200/40 blur-3xl lg:block" />
            <div className="absolute -right-10 bottom-10 hidden h-36 w-36 rounded-full bg-sky-200/40 blur-3xl lg:block" />
            <div className="relative rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
              <div className="rounded-[1.6rem] border border-slate-200 bg-slate-950 p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                    <CheckSquare2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Workspace</p>
                    <p className="text-sm font-medium text-white">Sidebar + task tree</p>
                  </div>
                </div>
                <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/5 p-3">
                  <div className="space-y-2">
                    <div className="rounded-2xl bg-indigo-400/15 px-3 py-3 text-sm text-indigo-100">All Tasks</div>
                    <div className="rounded-2xl bg-white/5 px-3 py-3 text-sm text-slate-300">Today</div>
                    <div className="rounded-2xl bg-white/5 px-3 py-3 text-sm text-slate-300">Tomorrow</div>
                    <div className="rounded-2xl bg-white/5 px-3 py-3 text-sm text-slate-300">This Week</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current Build</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">One product. One app.</h3>
                  </div>
                  <Sunrise className="h-8 w-8 text-indigo-500" />
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Auth, subscriptions, migrated task data, and the workspace shell now live together. The public site can evolve again without fighting the app routes.
                </p>
                <div className="mt-5 overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white">
                  <Image
                    src="/media/plan-my-workday/og-image.png"
                    alt="PlanMyWorkday preview"
                    width={1200}
                    height={630}
                    className="h-auto w-full"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </main>
  );
}

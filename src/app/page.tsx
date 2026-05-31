import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Clock, Keyboard, Play, Star, Zap } from "lucide-react";
import FeatureImageHomepage from "@/features/marketing/components/FeatureImageHomepage";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plan My Workday",
  description: "A keyboard-first task manager for fast planning, focus, and daily execution.",
};

const feature = {
  title: "Keyboard-First Power",
  description: "Navigate at thought speed. Timer built in. No friction.",
  gradient: "from-indigo-500 via-blue-600 to-purple-700",
};

const testimonials = [
  {
    name: "Sarah M.",
    role: "Marketing Manager",
    content: "I can finally keep up with my brain. Keyboard everywhere and a timer that actually helps me focus.",
    rating: 5,
    avatar: "SM",
    gradient: "from-indigo-600 to-purple-700",
  },
  {
    name: "Marcus T.",
    role: "Software Engineer",
    content: "Never touching my mouse again. The timer integration is genius. Finally found a focus setup that sticks.",
    rating: 5,
    avatar: "MT",
    gradient: "from-blue-600 to-cyan-700",
  },
];

export default function HomePage() {
  return (
    <>
      <header className="relative z-20 px-4 sm:px-6 lg:px-8">
        <MarketingHeader />
      </header>

      <main className="relative">
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" />
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.2),rgba(0,0,0,0))]" />

        <section className="relative flex min-h-screen items-center overflow-hidden px-4 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute right-1/6 top-1/4 h-20 w-36 -rotate-6 rounded-lg border border-white/30 bg-white/20 opacity-40 backdrop-blur-sm">
              <div className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-green-400/60" />
                  <div className="h-2 w-20 rounded-full bg-slate-400/25" />
                </div>
                <div className="h-1.5 w-16 rounded-full bg-slate-400/20" />
                <div className="h-1.5 w-full rounded-full bg-white/40">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-green-400/50 to-teal-400/50" />
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <div className="text-center">
              <h1 className="mb-8 text-5xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl lg:text-7xl xl:text-8xl">
                Finally.{" "}
                <span className="relative">
                  <span className="text-indigo-600 dark:text-indigo-400">
                    Task management
                  </span>
                  <span className="absolute -inset-1 -z-10 bg-gradient-to-r from-indigo-600/20 via-blue-600/20 to-purple-700/20 blur-xl dark:from-indigo-400/20 dark:via-blue-500/20 dark:to-purple-600/20" />
                </span>{" "}
                as fast as your brain.
              </h1>

              <p className="mx-auto mb-12 max-w-5xl text-xl font-medium leading-relaxed text-slate-600 dark:text-slate-300 sm:text-2xl lg:text-3xl">
                Full keyboard navigation. Built-in timer. Zero friction. Maximum focus.
              </p>

              <div className="mx-auto mb-8 flex max-w-md flex-col items-center justify-center gap-4">
                <Link
                  href="/app/workspace/all-tasks"
                  className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl"
                >
                  Try it free
                  <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>

                <Link
                  href="/media/plan-my-workday/demo.mp4"
                  prefetch={false}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:from-slate-800 hover:via-slate-900 hover:to-black hover:shadow-xl"
                >
                  <Play className="size-5" />
                  Watch Demo
                </Link>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400">No bullshit. No credit card. Just results.</p>
            </div>
          </div>
        </section>

        <section id="features" className="relative flex min-h-screen items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mb-20 text-center">
              <h2 className="mb-6 text-4xl font-bold text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
                Stop{" "}
                <span className="text-indigo-600 dark:text-indigo-400">
                  fighting your tools.
                </span>
              </h2>
              <p className="mx-auto max-w-4xl text-xl text-slate-600 dark:text-slate-300">
                Your task manager should keep up with you. Not slow you down. Not make you click around like an idiot.
              </p>
            </div>

            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="space-y-12">
                <div className="group">
                  <div className="mb-4 flex items-start gap-4">
                    <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}>
                      <Keyboard className="size-6 text-white" />
                    </div>
                    <div>
                      <h3 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Blazing Fast</h3>
                      <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                        Full keyboard navigation. Add tasks at the speed of thought. No mouse. No clicking. No dragging bullshit.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="group">
                  <div className="mb-4 flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-teal-600 to-cyan-700 shadow-lg">
                      <Clock className="size-6 text-white" />
                    </div>
                    <div>
                      <h3 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Timer Built In</h3>
                      <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                        Pomodoro timer integrated into your workspace. Plan it. Time it. Get it done. All in one place.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="group">
                  <div className="mb-4 flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700 shadow-lg">
                      <Zap className="size-6 text-white" />
                    </div>
                    <div>
                      <h3 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Zero Friction</h3>
                      <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                        Your brain does not stop for UI. Why should your task manager? Stay focused without fighting the interface.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <FeatureImageHomepage />
            </div>
          </div>
        </section>

        <section id="testimonials" className="relative flex min-h-screen items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mb-20 text-center">
              <h2 className="mb-6 text-4xl font-bold text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
                People actually{" "}
                <span className="text-indigo-600 dark:text-indigo-400">
                  use this stuff
                </span>
              </h2>
              <p className="mx-auto max-w-3xl text-xl text-slate-600 dark:text-slate-300">
                These people ditched their old systems for something faster.
              </p>
            </div>

            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
              {testimonials.map((testimonial) => (
                <div key={testimonial.name} className="group">
                  <div className="rounded-3xl border border-slate-200/50 bg-white/70 p-8 shadow-xl backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl dark:border-slate-700/50 dark:bg-slate-800/50">
                    <div className="mb-6 flex items-center">
                      <div className={`flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br ${testimonial.gradient} text-lg font-bold text-white shadow-lg`}>
                        {testimonial.avatar}
                      </div>
                      <div className="ml-4">
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">{testimonial.name}</h4>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{testimonial.role}</p>
                      </div>
                    </div>

                    <div className="mb-6 flex gap-1">
                      {Array.from({ length: testimonial.rating }).map((_, index) => (
                        <Star key={index} className="size-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>

                    <blockquote className="font-medium leading-relaxed text-slate-700 dark:text-slate-300">{testimonial.content}</blockquote>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-4xl text-center">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-indigo-600/20 via-blue-600/20 to-purple-700/20 blur-3xl dark:from-indigo-400/10 dark:via-blue-500/10 dark:to-purple-600/10" />

            <div className="relative">
              <h2 className="mb-8 text-4xl font-bold text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
                Ready to stop{" "}
                <span className="text-indigo-600 dark:text-indigo-400">
                  disappointing yourself?
                </span>
              </h2>
              <p className="mb-12 text-xl leading-relaxed text-slate-600 dark:text-slate-300 sm:text-2xl">
                Try it for free. See what you have been missing.
              </p>

              <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
                <Link
                  href="/app/workspace/all-tasks"
                  className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl"
                >
                  Try it free
                  <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <p className="text-slate-500 dark:text-slate-400">No credit card. Takes 30 seconds.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 px-4 sm:px-6 lg:px-8">
        <MarketingFooter />
      </footer>
    </>
  );
}

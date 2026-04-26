/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";

export const dynamic = "force-dynamic";

const features = [
  {
    title: "Blazing Fast",
    description: "Full keyboard navigation. Add tasks at the speed of thought. No mouse. No dragging.",
    badge: "K",
  },
  {
    title: "Timer Built In",
    description: "Pomodoro flow lives next to your work, so planning and doing do not split into different tools.",
    badge: "25",
  },
  {
    title: "Zero Friction",
    description: "Your task manager should keep up with your brain instead of making you click through ceremony.",
    badge: "Z",
  },
];

const testimonials = [
  {
    name: "Sarah M.",
    role: "Marketing Manager",
    content: "I can finally keep up with my brain. Keyboard everywhere and a timer that actually helps me focus.",
    avatar: "SM",
  },
  {
    name: "Marcus T.",
    role: "Software Engineer",
    content: "Never touching my mouse again. The timer integration is genius. Finally found my flow state.",
    avatar: "MT",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <section className="relative flex min-h-[calc(100vh-6rem)] items-center overflow-hidden py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))]" />
          <div className="relative z-10 mx-auto w-full max-w-6xl text-center">
            <h1 className="text-5xl font-bold tracking-normal text-slate-950 sm:text-6xl lg:text-7xl xl:text-8xl">
              Finally.{" "}
              <span className="bg-gradient-to-r from-indigo-500 via-blue-600 to-purple-700 bg-clip-text text-transparent">
                Task management
              </span>{" "}
              as fast as your brain.
            </h1>
            <p className="mx-auto mt-8 max-w-5xl text-xl font-medium leading-8 text-slate-600 sm:text-2xl lg:text-3xl">
              Full keyboard navigation. Built-in timer. Zero friction. Maximum focus.
            </p>

            <div className="mx-auto mt-10 flex max-w-md flex-col items-center justify-center gap-4">
              <Link
                href="/app/workspace/all-tasks"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-blue-600 to-purple-700 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:from-indigo-600 hover:via-blue-700 hover:to-purple-800"
              >
                Try it free
                <span aria-hidden="true" className="transition group-hover:translate-x-1">
                  -&gt;
                </span>
              </Link>
              <button className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:from-slate-800 hover:via-slate-900 hover:to-black">
                <span aria-hidden="true" className="text-sm">
                  &gt;
                </span>
                Watch Demo
              </button>
            </div>

            <p className="mt-5 text-sm text-slate-500">No credit card. Just results.</p>
          </div>
        </section>

        <section id="features" className="flex min-h-screen items-center py-16">
          <div className="w-full">
            <div className="mb-16 text-center">
              <h2 className="text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
                Stop{" "}
                <span className="bg-gradient-to-r from-indigo-500 via-blue-600 to-purple-700 bg-clip-text text-transparent">
                  fighting your tools.
                </span>
              </h2>
              <p className="mx-auto mt-6 max-w-4xl text-xl leading-8 text-slate-600">
                Your task manager should keep up with you. Not slow you down. Not make you click around.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div className="space-y-10">
                {features.map((feature) => {
                  return (
                    <div key={feature.title} className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-purple-700 text-sm font-black tracking-tight text-white shadow-lg">
                        {feature.badge}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-950">{feature.title}</h3>
                        <p className="mt-2 text-lg leading-8 text-slate-600">{feature.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <img
                  src="/media/plan-my-workday/og-image.png"
                  alt="Plan My Workday app preview"
                  width={1536}
                  height={1024}
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="testimonials" className="flex min-h-screen items-center py-16">
          <div className="w-full">
            <div className="mb-16 text-center">
              <h2 className="text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
                People actually{" "}
                <span className="bg-gradient-to-r from-indigo-500 via-blue-600 to-purple-700 bg-clip-text text-transparent">
                  use this stuff
                </span>
              </h2>
              <p className="mx-auto mt-6 max-w-3xl text-xl leading-8 text-slate-600">
                These people ditched their old systems for something faster.
              </p>
            </div>

            <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
              {testimonials.map((testimonial) => {
                return (
                  <div
                    key={testimonial.name}
                    className="rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-2xl"
                  >
                    <div className="mb-6 flex items-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-lg font-bold text-white shadow-lg">
                        {testimonial.avatar}
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-bold text-slate-950">{testimonial.name}</h3>
                        <p className="text-sm font-medium text-slate-600">{testimonial.role}</p>
                      </div>
                    </div>
                    <div className="mb-6 flex gap-1">
                      {[0, 1, 2, 3, 4].map((star) => (
                        <span key={star} className="text-lg leading-none text-yellow-400">
                          *
                        </span>
                      ))}
                    </div>
                    <blockquote className="font-medium leading-8 text-slate-700">{testimonial.content}</blockquote>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </main>
  );
}

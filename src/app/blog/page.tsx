/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";
import { getBlogPosts } from "@/features/marketing/blog-data/posts";

export const metadata: Metadata = {
  title: "Blog",
  description: "Productivity and task-management writing from PlanMyWorkday.",
};

export const dynamic = "force-dynamic";

export default function BlogListingPage() {
  const posts = getBlogPosts();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <section className="py-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">Blog</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            The old PlanMyWorkday writing is back.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Productivity, ADHD, planning, and work systems content from the original site, now living beside the rebuilt app instead of being buried behind it.
          </p>
        </section>

        <section className="grid gap-6 pb-16">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group grid gap-6 rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)] md:grid-cols-[260px_minmax(0,1fr)] md:p-6"
            >
              <div className="relative overflow-hidden rounded-[1.3rem] border border-slate-200 bg-slate-100">
                <img src={post.image} alt={post.title} width={640} height={420} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true">Date</span>
                    {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true">Time</span>
                    {post.readTime}
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{post.title}</h2>
                <p className="mt-3 text-base leading-7 text-slate-600">{post.description}</p>
                <div className="mt-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{post.author}</p>
                    <p className="truncate text-sm text-slate-500">{post.authorRole}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">
                    Read article
                    <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                      -&gt;
                    </span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>

        <MarketingFooter />
      </div>
    </main>
  );
}

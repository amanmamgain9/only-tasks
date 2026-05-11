/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";
import { getAllBlogSlugs, getBlogPost } from "@/features/marketing/blog-data/posts";
import { absoluteUrl } from "@/features/marketing/seo";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: "Blog Post Not Found | Plan My Workday",
      description: "The requested blog post could not be found.",
    };
  }

  const imageUrl = post.image ? absoluteUrl(post.image) : absoluteUrl("/media/plan-my-workday/og-image.png");
  const canonicalUrl = absoluteUrl(`/blog/${post.slug}`);

  return {
    title: `${post.title} | Plan My Workday Blog`,
    description: post.description,
    keywords: post.tags,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      url: canonicalUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [imageUrl],
    },
  };
}

function buildArticleSchema(post: NonNullable<ReturnType<typeof getBlogPost>>) {
  const imageUrl = post.image ? absoluteUrl(post.image) : absoluteUrl("/media/plan-my-workday/og-image.png");

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: imageUrl,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Person",
      name: post.author,
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
      "@id": absoluteUrl(`/blog/${post.slug}`),
    },
    keywords: post.tags.join(", "),
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const articleSchema = buildArticleSchema(post);

  return (
    <main className="relative min-h-screen text-slate-950 dark:text-white">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.2),rgba(0,0,0,0))]" />

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <article className="pb-16 pt-10">
          <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-700 dark:bg-slate-800/55 md:p-8">
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

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">{post.title}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">{post.description}</p>

            <div className="mt-8 overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-100">
              <img src={post.image} alt={post.title} width={1200} height={720} className="h-auto w-full object-cover" />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="font-medium text-slate-900 dark:text-slate-100">{post.author}</span>
              <span className="text-slate-400">/</span>
              <span>{post.authorRole}</span>
            </div>

            <div className="article-content mt-10" dangerouslySetInnerHTML={{ __html: post.content || "<p>No content available.</p>" }} />

            <div className="mt-10 border-t border-slate-200 pt-6">
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                    <span aria-hidden="true" className="text-indigo-500">
                      #
                    </span>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>

        <MarketingFooter />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    </main>
  );
}

import type { MetadataRoute } from "next";
import { getAllBlogSlugs, getBlogPosts } from "@/features/marketing/blog-data/posts";
import {
  marketingAlternatives,
  marketingFeatures,
  marketingUseCases,
} from "@/features/marketing/seo-page-data";
import { absoluteUrl } from "@/features/marketing/seo";

const staticRoutes = [
  "",
  "/about",
  "/alternatives",
  "/blog",
  "/contact",
  "/faq",
  "/features",
  "/pricing",
  "/privacy",
  "/terms",
  "/use-case",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const postsBySlug = new Map(getBlogPosts().map((post) => [post.slug, post]));
  const makeEntry = (
    url: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    lastModified: Date = now,
  ): MetadataRoute.Sitemap[number] => ({
    url,
    lastModified,
    changeFrequency,
    priority,
  });

  return [
    ...staticRoutes.map((route) => makeEntry(absoluteUrl(route || "/"), route === "" ? 1 : 0.7, route === "" ? "weekly" : "monthly")),
    ...marketingFeatures.map((feature) => makeEntry(absoluteUrl(`/features/${feature.slug}`), 0.75, "monthly")),
    ...marketingUseCases.map((useCase) => makeEntry(absoluteUrl(`/use-case/${useCase.slug}`), 0.75, "monthly")),
    ...marketingAlternatives.map((alternative) => makeEntry(absoluteUrl(`/alternatives/${alternative.slug}`), 0.7, "monthly")),
    ...getAllBlogSlugs().map((slug) =>
      makeEntry(absoluteUrl(`/blog/${slug}`), 0.65, "monthly", new Date(postsBySlug.get(slug)?.date || now)),
    ),
  ];
}

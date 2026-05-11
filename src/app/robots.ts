import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/features/marketing/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/", "/sign-in", "/all-tasks", "/today", "/tomorrow", "/this-week"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl,
  };
}

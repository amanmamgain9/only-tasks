import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://planmyworkday.com";

export const seoMetadata: Metadata = {
  title: {
    template: "%s | Plan My Workday",
    default: "Plan My Workday - AI-Powered Work Plans for Maximum Productivity",
  },
  description:
    "Create personalized work plans using AI that match your energy levels, preferences, and goals. Built for ADHD, students, freelancers, and professionals.",
  keywords: [
    "productivity",
    "ADHD",
    "work plan",
    "focus",
    "energy optimization",
    "pomodoro timer",
    "task management",
    "freelancers",
  ],
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Plan My Workday",
    title: "Plan My Workday - AI-Powered Work Plans",
    description: "Create personalized work plans using AI that match your energy levels, preferences, and goals.",
    images: [
      {
        url: "/media/plan-my-workday/og-image.png",
        width: 1536,
        height: 1024,
        alt: "Plan My Workday App",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Plan My Workday - AI-Powered Work Plans",
    description: "Create personalized work plans using AI that match your energy levels, preferences, and goals.",
    creator: "@planmyworkday",
    site: "@planmyworkday",
    images: ["/media/plan-my-workday/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Plan My Workday",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "4",
    priceCurrency: "USD",
  },
  description: "AI-powered work plans that maximize productivity for different working styles",
  image: `${siteUrl}/media/plan-my-workday/og-image.png`,
  url: siteUrl,
  author: {
    "@type": "Organization",
    name: "Plan My Workday",
  },
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Plan My Workday",
  url: siteUrl,
};

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Plan My Workday",
  url: siteUrl,
  logo: `${siteUrl}/media/plan-my-workday/logo.jpg`,
  sameAs: ["https://twitter.com/planmyworkday"],
};


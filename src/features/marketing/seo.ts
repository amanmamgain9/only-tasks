import type { Metadata } from "next";

const FALLBACK_SITE_URL = "https://planmyworkday.dev";
const defaultOgImage = "/media/plan-my-workday/og-image.png";

function normalizeSiteUrl(value: string | undefined) {
  const candidate = (value || FALLBACK_SITE_URL).replace(/\/+$/, "");

  try {
    return new URL(candidate).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export function absoluteUrl(path: string) {
  return new URL(path, `${siteUrl}/`).toString();
}

export function buildMarketingMetadata({
  title,
  description,
  path,
  image = defaultOgImage,
  keywords,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string | string[];
  type?: "website" | "article";
}): Metadata {
  const canonical = absoluteUrl(path);
  const imageUrl = image.startsWith("http") ? image : absoluteUrl(image);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Plan My Workday",
      type,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: "@planmyworkday",
      site: "@planmyworkday",
      images: [imageUrl],
    },
  };
}

export const seoMetadata: Metadata = {
  title: {
    template: "%s | Plan My Workday",
    default: "Plan My Workday - Keyboard-First Task Management",
  },
  description:
    "Plan projects, nested tasks, date-focused views, and focus sessions in one keyboard-first workspace.",
  keywords: [
    "productivity",
    "ADHD",
    "work plan",
    "focus",
    "keyboard-first task management",
    "nested tasks",
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
    title: "Plan My Workday - Keyboard-First Task Management",
    description: "Plan projects, nested tasks, date-focused views, and focus sessions in one keyboard-first workspace.",
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
    title: "Plan My Workday - Keyboard-First Task Management",
    description: "Plan projects, nested tasks, date-focused views, and focus sessions in one keyboard-first workspace.",
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
  description: "Keyboard-first task management with nested tasks, date-focused views, and focus sessions",
  image: absoluteUrl(defaultOgImage),
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
  logo: absoluteUrl("/media/plan-my-workday/logo.jpg"),
  sameAs: ["https://twitter.com/planmyworkday"],
};

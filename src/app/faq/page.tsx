import type { Metadata } from "next";
import SimpleMarketingPage from "@/features/marketing/components/SimpleMarketingPage";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Common questions about Plan My Workday.",
};

export default function FAQPage() {
  return (
    <SimpleMarketingPage
      eyebrow="FAQ"
      title="Common questions."
      description="The rebuilt app keeps the task-management core focused while public content, auth, and subscriptions live in the same Next.js codebase."
      points={["The workspace now lives at /app", "SQLite runs locally on the EC2 setup", "The old blog content is available at /blog"]}
    />
  );
}

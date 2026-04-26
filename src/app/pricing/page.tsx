import type { Metadata } from "next";
import SimpleMarketingPage from "@/features/marketing/components/SimpleMarketingPage";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Plan My Workday pricing and subscription information.",
};

export default function PricingPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Pricing"
      title="Start free. Upgrade when the workflow proves itself."
      description="Legacy subscription data is preserved in the migrated app while billing moves toward Paddle."
      points={["Free local workspace access during migration", "Legacy subscriptions marked for review", "Paddle-ready billing model"]}
    />
  );
}

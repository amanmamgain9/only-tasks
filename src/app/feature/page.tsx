import type { Metadata } from "next";
import SimpleMarketingPage from "@/features/marketing/components/SimpleMarketingPage";

export const metadata: Metadata = {
  title: "Features",
  description: "Keyboard-first task management, date views, and focused work planning in Plan My Workday.",
};

export default function FeaturePage() {
  return (
    <SimpleMarketingPage
      eyebrow="Features"
      title="Task management as fast as your brain."
      description="Plan My Workday keeps the fast task tree, keyboard movement, date views, and focus timer in one workspace."
      points={["Keyboard-first task entry and navigation", "Nested task trees with date views", "Focused workspace under /app"]}
    />
  );
}

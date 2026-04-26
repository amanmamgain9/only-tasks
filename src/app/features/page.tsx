import type { Metadata } from "next";
import SimpleMarketingPage from "@/features/marketing/components/SimpleMarketingPage";

export const metadata: Metadata = {
  title: "Features",
  description: "Keyboard-first task management, scheduling views, and focused work planning in Plan My Workday.",
};

export default function FeaturesPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Features"
      title="Task management as fast as your brain."
      description="Plan My Workday keeps the fast task tree, keyboard movement, date views, and focus flow in one workspace."
      points={["Keyboard-first task entry and navigation", "Nested task trees with schedule views", "Focused workspace under /app"]}
    />
  );
}

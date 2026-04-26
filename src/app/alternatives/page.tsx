import type { Metadata } from "next";
import SimpleMarketingPage from "@/features/marketing/components/SimpleMarketingPage";

export const metadata: Metadata = {
  title: "Alternatives",
  description: "Plan My Workday alternatives and comparisons.",
};

export default function AlternativesPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Alternatives"
      title="Built for keyboard-speed planning."
      description="Plan My Workday is focused on fast nested tasks, scheduling views, and workday flow instead of broad project-management ceremony."
      points={["Faster than click-heavy task apps", "More focused than all-in-one suites", "Designed around daily execution"]}
    />
  );
}

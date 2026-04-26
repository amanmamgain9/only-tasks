import type { Metadata } from "next";
import SimpleMarketingPage from "@/features/marketing/components/SimpleMarketingPage";

export const metadata: Metadata = {
  title: "Use Cases",
  description: "Ways to use Plan My Workday for task planning and focused execution.",
};

export default function UseCasePage() {
  return (
    <SimpleMarketingPage
      eyebrow="Use Cases"
      title="For people whose workday changes fast."
      description="Use Plan My Workday to capture messy work, break it into nested tasks, and switch between all work and date-focused views."
      points={["ADHD-friendly planning", "Freelance and student workflows", "Daily work execution"]}
    />
  );
}

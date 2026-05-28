import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import WorkspaceApp from "@/features/workspace/components/WorkspaceApp";
import { requireWorkspaceSession } from "@/features/workspace/requireWorkspaceSession";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AppHomePage() {
  noStore();
  const viewer = await requireWorkspaceSession("/app");
  return <WorkspaceApp viewer={viewer} />;
}

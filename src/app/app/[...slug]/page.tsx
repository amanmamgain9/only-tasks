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

export default async function AppCatchAllPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  noStore();
  const resolvedParams = await params;
  const slug = resolvedParams.slug?.join("/") || "";
  await requireWorkspaceSession(`/app/${slug}`);
  return <WorkspaceApp />;
}

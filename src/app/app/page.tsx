import { unstable_noStore as noStore } from "next/cache";
import WorkspaceApp from "@/features/workspace/components/WorkspaceApp";
import { requireWorkspaceSession } from "@/features/workspace/requireWorkspaceSession";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  noStore();
  await requireWorkspaceSession("/app");
  return <WorkspaceApp />;
}

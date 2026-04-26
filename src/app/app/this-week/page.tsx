import { unstable_noStore as noStore } from "next/cache";
import MyWorkplaceComponent from "@/features/workspace/components/MyWorkplaceComponents/MyWorkplaceComponent";
import { requireWorkspaceSession } from "@/features/workspace/requireWorkspaceSession";

export const dynamic = "force-dynamic";

export default async function AppThisWeekPage() {
  noStore();
  await requireWorkspaceSession("/app/this-week");
  return <MyWorkplaceComponent regionOrder={1} dueDateFilter="this-week" />;
}

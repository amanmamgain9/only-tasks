import { unstable_noStore as noStore } from "next/cache";
import MyWorkplaceComponent from "@/features/workspace/components/MyWorkplaceComponents/MyWorkplaceComponent";
import { requireWorkspaceSession } from "@/features/workspace/requireWorkspaceSession";

export const dynamic = "force-dynamic";

export default async function AppTodayPage() {
  noStore();
  await requireWorkspaceSession("/app/today");
  return <MyWorkplaceComponent regionOrder={1} dueDateFilter="today" />;
}

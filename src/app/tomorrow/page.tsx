import { unstable_noStore as noStore } from "next/cache";
import MyWorkplaceComponent from "@/features/workspace/components/MyWorkplaceComponents/MyWorkplaceComponent";

export const dynamic = "force-dynamic";

export default function TomorrowPage() {
  noStore();
  return <MyWorkplaceComponent regionOrder={1} dueDateFilter="tomorrow" />;
}

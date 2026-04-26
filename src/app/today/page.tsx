import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TodayRedirectPage() {
  redirect("/app/workspace/today");
}

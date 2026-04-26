import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TomorrowRedirectPage() {
  redirect("/app/workspace/tomorrow");
}

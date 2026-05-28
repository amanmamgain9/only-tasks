import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "This Week",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ThisWeekRedirectPage() {
  redirect("/app/workspace/this-week");
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TodayRedirectPage() {
  redirect("/app/workspace/today");
}

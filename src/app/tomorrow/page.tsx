import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tomorrow",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TomorrowRedirectPage() {
  redirect("/app/workspace/tomorrow");
}

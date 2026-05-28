import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All Tasks",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AllTasksRedirectPage() {
  redirect("/app/workspace/all-tasks");
}

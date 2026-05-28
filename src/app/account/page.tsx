import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { CreditCard, LogOut, UserRound } from "lucide-react";
import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";
import { getCurrentUserFromRequest, SESSION_COOKIE_NAME } from "@/server/auth";

export const metadata: Metadata = {
  title: "Account",
  description: "View your Plan My Workday account details.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect(`/sign-in?next=${encodeURIComponent("/account")}`);
  }

  const requestHeaders = await headers();
  const user = await getCurrentUserFromRequest(
    new Request("http://local.planmyworkday/account", {
      headers: {
        cookie: requestHeaders.get("cookie") || "",
      },
    }),
  );

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent("/account")}`);
  }

  return (
    <main className="relative min-h-screen text-slate-950 dark:text-white">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <MarketingHeader />

        <section className="mx-auto w-full max-w-2xl flex-1 py-16 sm:py-20">
          <div className="rounded-lg border border-slate-200/70 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <UserRound className="size-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Account</h1>
                <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4">
              <div className="rounded-lg border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/70 dark:bg-slate-950/30">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Profile</p>
                <p className="mt-2 text-base font-medium text-slate-950 dark:text-white">{user.name || "No name set"}</p>
              </div>

              <div className="rounded-lg border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/70 dark:bg-slate-950/30">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Access</p>
                <p className="mt-2 text-base font-medium text-slate-950 dark:text-white">{user.subscription?.label || "Free"}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{user.subscription?.note || "No active subscription."}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/app/workspace/all-tasks"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Open workspace
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <CreditCard className="size-4" />
                View plans
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted sm:w-auto"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </main>
  );
}

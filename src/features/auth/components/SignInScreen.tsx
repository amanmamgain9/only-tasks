"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DevUser = {
  id: number;
  name: string | null;
  email: string;
};

const errorMessages: Record<string, string> = {
  missing_google_code: "Google returned without the required authorization code.",
  invalid_google_state: "The Google sign-in flow expired or failed state verification. Try again.",
  google_login_failed: "Google sign-in failed before the session could be created.",
};

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/app/workspace/all-tasks";
  }

  try {
    const parsed = new URL(value, "http://local.planmyworkday");
    if (parsed.pathname === "/sign-in" || parsed.pathname.startsWith("/api/")) {
      return "/app/workspace/all-tasks";
    }
    if (parsed.pathname === "/app" || parsed.pathname.startsWith("/app/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    if (["/all-tasks", "/today", "/tomorrow", "/this-week"].includes(parsed.pathname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return "/app/workspace/all-tasks";
  }

  return "/app/workspace/all-tasks";
}

export default function SignInScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [devAuthEnabled, setDevAuthEnabled] = useState(false);
  const [recentUsers, setRecentUsers] = useState<DevUser[]>([]);

  const nextPath = sanitizeNextPath(searchParams?.get("next") || null);
  const errorCode = searchParams?.get("error");
  const errorMessage = errorCode ? errorMessages[errorCode] ?? "Unable to complete sign-in." : null;

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      const meResponse = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (meResponse.ok) {
        router.replace(nextPath);
        return;
      }

      const devUsersResponse = await fetch("/api/auth/dev-users", {
        credentials: "include",
        cache: "no-store",
      });

      if (!devUsersResponse.ok) {
        if (!cancelled) {
          setRecentUsers([]);
          setGoogleEnabled(false);
          setDevAuthEnabled(false);
        }
        return;
      }

      const payload = (await devUsersResponse.json()) as {
        success: boolean;
        data?: {
          googleEnabled: boolean;
          devAuthEnabled: boolean;
          users: DevUser[];
        };
      };

      if (!cancelled && payload.data) {
        setGoogleEnabled(payload.data.googleEnabled);
        setDevAuthEnabled(payload.data.devAuthEnabled);
        setRecentUsers(payload.data.users);
      }
    }

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  const featureCards = useMemo(
    () => [
      ["Task Tree", "Nested tasks, ordering, and optimistic edits in one workspace."],
      ["Keyboard", "Sidebar, workspace, and modal scopes keep the fast navigation model."],
      ["Focus", "Jump into today, this week, or the full tree without extra product noise."],
    ],
    [],
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_28%),linear-gradient(180deg,#faf7f0_0%,#f3efe6_48%,#ebe3d4_100%)] px-4 py-8 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-stone-300/80 bg-white/70 p-8 shadow-[0_35px_100px_rgba(41,37,36,0.12)] backdrop-blur md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-700">Plan My Workday</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
            Sign in and get back to the workspace.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-stone-600 sm:text-lg">
            Your task tree, scheduling views, and keyboard scope system are preserved in the rebuilt app.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {featureCards.map(([title, description]) => (
              <div
                key={title}
                className="rounded-2xl border border-stone-200/80 bg-stone-50/90 p-4 shadow-[0_14px_32px_rgba(120,113,108,0.08)]"
              >
                <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-900/10 bg-stone-950 p-7 text-stone-100 shadow-[0_30px_90px_rgba(28,25,23,0.28)] md:p-8">
          <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Sign In</p>
                <h2 className="mt-3 text-2xl font-semibold text-stone-50">Continue into the workspace</h2>
              </div>
              <div className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">
                Workspace
              </div>
            </div>

            {errorMessage && (
              <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
                {errorMessage}
              </div>
            )}

            <div className="mt-6 space-y-4">
              {googleEnabled ? (
                <form action="/api/auth/google" method="post">
                  <input type="hidden" name="next" value={nextPath} />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                  >
                    Continue with Google
                  </button>
                </form>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-stone-300">
                  Google auth is not configured for this host. On `localhost`, this app uses `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. The `PLANMYWORKDAY_GOOGLE_*` values are only used on real `planmyworkday` hosts.
                </div>
              )}

              {devAuthEnabled && recentUsers.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Development</p>
                    <p className="mt-1 text-sm text-stone-300">Quick local sign-in for imported users.</p>
                  </div>
                  <div className="space-y-2">
                    {recentUsers.map((user) => (
                      <form key={user.id} action="/api/auth/dev-login" method="post" className="w-full">
                        <input type="hidden" name="userId" value={String(user.id)} />
                        <input type="hidden" name="redirectTo" value={nextPath} />
                        <button
                          type="submit"
                          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-stone-900/60 px-4 py-3 text-left transition hover:border-amber-300/40 hover:bg-stone-900"
                        >
                          <span>
                            <span className="block text-sm font-medium text-stone-100">{user.name || user.email}</span>
                            <span className="mt-1 block text-xs text-stone-400">{user.email}</span>
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">Sign In</span>
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="mt-6 text-xs leading-6 text-stone-500">
              If you are already signed in, this page redirects straight back to the workspace.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Clock, X } from "lucide-react";

type DevUser = {
  id: number;
  name: string | null;
  email: string;
};

type MeResponse = {
  success: boolean;
  data?: {
    subscription?: {
      isEntitled?: boolean;
    } | null;
  };
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

function isWorkspacePath(value: string) {
  try {
    const parsed = new URL(value, "http://local.planmyworkday");
    return parsed.pathname === "/app" || parsed.pathname.startsWith("/app/");
  } catch {
    return false;
  }
}

function getPostLoginRedirect(nextPath: string, payload: MeResponse) {
  if (isWorkspacePath(nextPath) && !payload.data?.subscription?.isEntitled) {
    return `/pricing?next=${encodeURIComponent(nextPath)}`;
  }
  return nextPath;
}

export default function SignInScreen() {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
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
        const payload = (await meResponse.json()) as MeResponse;
        replace(getPostLoginRedirect(nextPath, payload));
        return;
      }

      const devUsersResponse = await fetch("/api/auth/dev-users", {
        credentials: "include",
        cache: "no-store",
      });

      if (!devUsersResponse.ok) {
        if (!cancelled) {
          setRecentUsers([]);
          setGoogleEnabled(null);
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
  }, [nextPath, replace]);

  const featureCards = useMemo(
    () => [
      "Energy flow optimization",
      "Smart Pomodoro timers & breaks",
      "Weekly planning & progress tracking",
    ],
    [],
  );

  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <section className="relative w-full max-w-md overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl">
          <Link
            href="/"
            className="absolute right-0 top-0 z-10 p-3 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close sign in"
          >
            <X size={20} />
          </Link>

          <div className="px-6 pb-8 pt-12 text-center">
            <Clock className="mx-auto mb-6 text-primary" size={40} />

            <h1 className="mb-3 text-2xl font-bold text-card-foreground">Maximize Your Productivity</h1>

            <p className="mx-auto mb-8 max-w-sm text-muted-foreground">
              Sign in to create personalized AI-driven work plans and optimize your daily schedule.
            </p>

            {errorMessage && (
              <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
                {errorMessage}
              </div>
            )}

            <div className="mx-auto mb-8 max-w-xs space-y-2 text-left">
              {featureCards.map((point) => (
                <div key={point} className="flex items-center">
                  <CheckCircle className="mr-2 flex-shrink-0 text-primary" size={18} />
                  <span className="text-card-foreground">{point}</span>
                </div>
              ))}
            </div>

            {googleEnabled !== false ? (
              <form action="/api/auth/google" method="post" className="mx-auto mb-6 w-full max-w-xs">
                <input type="hidden" name="next" value={nextPath} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" className="mr-2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                      <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                      <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                      <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                      <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                    </g>
                  </svg>
                  Sign in with Google
                </button>
              </form>
            ) : (
              <div className="mx-auto mb-6 max-w-xs rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Google sign-in is not available for this host.
              </div>
            )}

            {devAuthEnabled && recentUsers.length > 0 && (
              <details className="mx-auto mb-6 max-w-xs rounded-lg border border-border bg-muted/30 p-3 text-left">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Development sign-in</summary>
                  <div className="space-y-2">
                    {recentUsers.map((user) => (
                      <form key={user.id} action="/api/auth/dev-login" method="post" className="w-full">
                        <input type="hidden" name="userId" value={String(user.id)} />
                        <input type="hidden" name="redirectTo" value={nextPath} />
                        <button
                          type="submit"
                        className="mt-2 flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left transition hover:bg-accent/50"
                        >
                          <span>
                            <span className="block text-sm font-medium text-foreground">{user.name || user.email}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">{user.email}</span>
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Sign In</span>
                        </button>
                      </form>
                    ))}
                  </div>
              </details>
            )}

            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="underline-offset-4 hover:underline">Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

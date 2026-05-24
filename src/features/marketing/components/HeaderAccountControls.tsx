"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";

type AuthState = {
  email: string;
  name: string | null;
};

type MeResponse = {
  success: boolean;
  data?: AuthState;
};

export default function HeaderAccountControls() {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthState() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as MeResponse;
        if (!cancelled && payload.data) {
          setAuthState({
            email: payload.data.email,
            name: payload.data.name,
          });
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    void loadAuthState();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return <div className="h-9 w-40" aria-hidden="true" />;
  }

  if (!authState) {
    return (
      <Link
        href="/sign-in?next=/app/workspace/all-tasks"
        className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-5 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/app/workspace/all-tasks"
        className="hidden max-w-44 truncate rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted sm:block"
        title={authState.email}
      >
        {authState.name || authState.email}
      </Link>
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </form>
    </div>
  );
}

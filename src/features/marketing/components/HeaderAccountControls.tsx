"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { useCurrentUserQuery } from "@/features/auth/hooks/useAuthQueries";

type AuthState = {
  email: string;
  name: string | null;
};

export default function HeaderAccountControls() {
  const { data: authState, isLoading } = useCurrentUserQuery<AuthState>();

  if (isLoading) {
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
        href="/account"
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
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </form>
    </div>
  );
}

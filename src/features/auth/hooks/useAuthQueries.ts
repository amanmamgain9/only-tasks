"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuthenticatedUser } from "@/server/auth";

export type CurrentUserResponse<TUser = AuthenticatedUser> = {
  success: boolean;
  data?: TUser;
};

export type DevAuthUser = {
  id: number;
  name: string | null;
  email: string;
};

export type DevAuthState = {
  googleEnabled: boolean;
  devAuthEnabled: boolean;
  users: DevAuthUser[];
};

async function getJsonOrThrow<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function useCurrentUserQuery<TUser = AuthenticatedUser>(enabled = true) {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const payload = await getJsonOrThrow<CurrentUserResponse<TUser>>("/api/auth/me");
      return payload.data ?? null;
    },
    enabled,
    retry: false,
    staleTime: 0,
  });
}

export function useDevAuthStateQuery(enabled = true) {
  return useQuery({
    queryKey: ["auth", "dev-users"],
    queryFn: async () => {
      const payload = await getJsonOrThrow<{ success: boolean; data?: DevAuthState }>("/api/auth/dev-users");
      return payload.data ?? { googleEnabled: false, devAuthEnabled: false, users: [] };
    },
    enabled,
    retry: false,
    staleTime: 0,
  });
}

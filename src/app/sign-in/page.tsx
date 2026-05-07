import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SignInScreen from "@/features/auth/components/SignInScreen";
import { getCurrentUserFromRequest, sanitizeAuthRedirectPath } from "@/server/auth";

export const dynamic = "force-dynamic";

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  noStore();
  const resolvedSearchParams = await searchParams;
  const nextPath = sanitizeAuthRedirectPath(getSearchValue(resolvedSearchParams?.next));
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") || "";
  const currentUser = await getCurrentUserFromRequest(
    new Request("http://local.planmyworkday/sign-in", {
      headers: {
        cookie: cookieHeader,
      },
    }),
  );

  if (currentUser) {
    redirect(nextPath);
  }

  return (
    <Suspense fallback={null}>
      <SignInScreen />
    </Suspense>
  );
}

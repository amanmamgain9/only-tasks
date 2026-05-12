import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { BillingRequiredError } from "@/server/billing/enforcement";
import { getWorkspaceUserFromRequest, SESSION_COOKIE_NAME, UnauthorizedError } from "@/server/auth";

export async function requireWorkspaceSession(nextPath: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  const requestHeaders = await headers();
  try {
    await getWorkspaceUserFromRequest(
      new Request("http://local.planmyworkday/app", {
        headers: {
          cookie: requestHeaders.get("cookie") || "",
        },
      }),
    );
  } catch (error) {
    if (error instanceof BillingRequiredError) {
      redirect(`/pricing?next=${encodeURIComponent(nextPath)}`);
    }
    if (error instanceof UnauthorizedError) {
      redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
    }
    throw error;
  }
}

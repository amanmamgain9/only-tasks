import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { BillingRequiredError } from "@/server/billing/enforcement";
import { getWorkspaceUserFromRequest, SESSION_COOKIE_NAME, UnauthorizedError, type AuthenticatedUser } from "@/server/auth";

export async function requireWorkspaceSession(nextPath: string): Promise<AuthenticatedUser> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  const requestHeaders = await headers();
  let redirectPath: string | null = null;

  try {
    return await getWorkspaceUserFromRequest(
      new Request("http://local.planmyworkday/app", {
        headers: {
          cookie: requestHeaders.get("cookie") || "",
        },
      }),
    );
  } catch (error) {
    if (error instanceof BillingRequiredError) {
      redirectPath = `/pricing?next=${encodeURIComponent(nextPath)}`;
    } else if (error instanceof UnauthorizedError) {
      redirectPath = `/sign-in?next=${encodeURIComponent(nextPath)}`;
    } else {
      throw error;
    }
  }

  if (redirectPath) {
    redirect(redirectPath);
  }

  throw new Error("Workspace session could not be resolved.");
}

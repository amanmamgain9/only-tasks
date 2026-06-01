import type { NextApiRequest, NextApiResponse } from "next";
import {
  DEFAULT_AUTH_REDIRECT,
  isDevelopmentSignInUser,
  isDevelopmentAuthEnabled,
  resolvePostLoginRedirectForUserId,
  sanitizeAuthRedirectPath,
  SESSION_COOKIE_NAME,
  signInAsExistingUser,
} from "@/server/auth";
import { resolveOrigin, serializeCookie } from "@/server/api/helpers";

function getIpAddress(req: NextApiRequest) {
  const header = req.headers["x-forwarded-for"];
  if (typeof header === "string") {
    return header.split(",")[0]?.trim() ?? null;
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  if (!isDevelopmentAuthEnabled()) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  const userId = Number(req.body?.userId);
  const redirectTo = sanitizeAuthRedirectPath(
    typeof req.body?.redirectTo === "string" ? req.body.redirectTo : DEFAULT_AUTH_REDIRECT,
  );

  if (!Number.isFinite(userId)) {
    res.status(400).json({ success: false, error: "Invalid user ID" });
    return;
  }

  try {
    if (!(await isDevelopmentSignInUser(userId))) {
      res.status(404).json({ success: false, error: "Development sign-in user not found" });
      return;
    }

    const session = await signInAsExistingUser(userId, {
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      ipAddress: getIpAddress(req),
    });
    const postLoginRedirect = await resolvePostLoginRedirectForUserId(userId, redirectTo);

    res.setHeader(
      "Set-Cookie",
      serializeCookie(SESSION_COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: session.expiresAt,
        path: "/",
      }),
    );
    res.redirect(302, `${resolveOrigin(req)}${postLoginRedirect}`);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to sign in",
    });
  }
}

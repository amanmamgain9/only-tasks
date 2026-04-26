import type { NextApiRequest, NextApiResponse } from "next";
import { isDevelopmentAuthEnabled, SESSION_COOKIE_NAME, signInAsExistingUser } from "@/server/auth";
import { resolveOrigin, serializeCookie } from "./_helpers";

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
  const redirectTo = typeof req.body?.redirectTo === "string" ? req.body.redirectTo : "/app";

  if (!Number.isFinite(userId)) {
    res.status(400).json({ success: false, error: "Invalid user ID" });
    return;
  }

  try {
    const session = await signInAsExistingUser(userId, {
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      ipAddress: getIpAddress(req),
    });

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
    res.redirect(302, `${resolveOrigin(req)}${redirectTo}`);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to sign in",
    });
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import {
  buildGoogleAuthorizationRequest,
  GOOGLE_REDIRECT_COOKIE_NAME,
  GOOGLE_STATE_COOKIE_NAME,
} from "@/server/auth";
import { resolveOrigin, serializeCookie } from "./_helpers";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const nextPath =
      typeof req.body?.next === "string"
        ? req.body.next
        : typeof req.query.next === "string"
          ? req.query.next
          : "/";
    const result = buildGoogleAuthorizationRequest(resolveOrigin(req), nextPath);

    res.setHeader("Set-Cookie", [
      serializeCookie(GOOGLE_STATE_COOKIE_NAME, result.state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10,
        path: "/",
      }),
      serializeCookie(GOOGLE_REDIRECT_COOKIE_NAME, result.redirectTo, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10,
        path: "/",
      }),
    ]);
    res.redirect(307, result.authUrl);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start Google sign-in",
    });
  }
}

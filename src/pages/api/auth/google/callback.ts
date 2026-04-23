import type { NextApiRequest, NextApiResponse } from "next";
import {
  completeGoogleLogin,
  getNamedCookie,
  GOOGLE_REDIRECT_COOKIE_NAME,
  GOOGLE_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  UnauthorizedError,
} from "@/server/auth";
import { expireCookie, resolveOrigin, serializeCookie, toWebRequest } from "../_helpers";

function getIpAddress(req: NextApiRequest) {
  const header = req.headers["x-forwarded-for"];
  if (typeof header === "string") {
    return header.split(",")[0]?.trim() ?? null;
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = resolveOrigin(req);
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  if (!code || !state) {
    res.redirect(302, `${origin}/sign-in?error=missing_google_code`);
    return;
  }

  try {
    const webRequest = toWebRequest(req);
    const result = await completeGoogleLogin({
      code,
      state,
      expectedState: getNamedCookie(webRequest, GOOGLE_STATE_COOKIE_NAME),
      redirectTo: getNamedCookie(webRequest, GOOGLE_REDIRECT_COOKIE_NAME),
      origin,
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      ipAddress: getIpAddress(req),
    });

    res.setHeader("Set-Cookie", [
      expireCookie(GOOGLE_STATE_COOKIE_NAME),
      expireCookie(GOOGLE_REDIRECT_COOKIE_NAME),
      serializeCookie(SESSION_COOKIE_NAME, result.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: result.session.expiresAt,
        path: "/",
      }),
    ]);
    res.redirect(302, `${origin}${result.redirectTo || "/"}`);
  } catch (error) {
    res.setHeader("Set-Cookie", [
      expireCookie(GOOGLE_STATE_COOKIE_NAME),
      expireCookie(GOOGLE_REDIRECT_COOKIE_NAME),
    ]);
    const errorCode = error instanceof UnauthorizedError ? "invalid_google_state" : "google_login_failed";
    res.redirect(302, `${origin}/sign-in?error=${errorCode}`);
  }
}

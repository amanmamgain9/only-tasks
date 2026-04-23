import type { NextApiRequest, NextApiResponse } from "next";
import { revokeSessionFromRequest, SESSION_COOKIE_NAME } from "@/server/auth";
import { expireCookie, resolveOrigin, toWebRequest } from "./_helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  await revokeSessionFromRequest(toWebRequest(req));
  res.setHeader("Set-Cookie", expireCookie(SESSION_COOKIE_NAME));
  res.redirect(302, `${resolveOrigin(req)}/sign-in`);
}

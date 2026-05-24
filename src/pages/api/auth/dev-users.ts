import type { NextApiRequest, NextApiResponse } from "next";
import { isDevelopmentAuthEnabled, isGoogleAuthConfigured, listRecentUsers } from "@/server/auth";
import { resolveOrigin } from "@/server/api/helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const googleEnabled = isGoogleAuthConfigured(resolveOrigin(req));

  if (!isDevelopmentAuthEnabled()) {
    res.status(200).json({
      success: true,
      data: {
        googleEnabled,
        devAuthEnabled: false,
        users: [],
      },
    });
    return;
  }

  const users = await listRecentUsers(10);
  res.status(200).json({
    success: true,
    data: {
      googleEnabled,
      devAuthEnabled: true,
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      })),
    },
  });
}

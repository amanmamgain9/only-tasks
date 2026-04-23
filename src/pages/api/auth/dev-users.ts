import type { NextApiRequest, NextApiResponse } from "next";
import { isDevelopmentAuthEnabled, isGoogleAuthConfigured, listRecentUsers } from "@/server/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  if (!isDevelopmentAuthEnabled()) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  const users = await listRecentUsers(10);
  res.status(200).json({
    success: true,
    data: {
      googleEnabled: isGoogleAuthConfigured(),
      devAuthEnabled: true,
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      })),
    },
  });
}

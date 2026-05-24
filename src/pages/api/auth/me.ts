import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentUserFromRequest } from "@/server/auth";
import { toWebRequest } from "@/server/api/helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const user = await getCurrentUserFromRequest(toWebRequest(req));
  if (!user) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  res.status(200).json({ success: true, data: user });
}

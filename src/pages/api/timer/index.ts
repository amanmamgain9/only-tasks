import type { NextApiRequest, NextApiResponse } from "next";
import { toWebRequest } from "@/server/api/helpers";
import { getWorkspaceUserIdFromRequest } from "@/server/auth";
import { handleTimerApiError } from "@/server/timer/api";
import { getTimerStatusForUser } from "@/server/timer/service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));
    const status = await getTimerStatusForUser(userId);
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    handleTimerApiError(error, res, "Failed to load timer");
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { toWebRequest } from "@/server/api/helpers";
import { getWorkspaceUserIdFromRequest } from "@/server/auth";
import { handleTimerApiError } from "@/server/timer/api";
import { startTimerForUser } from "@/server/timer/service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));
    const status = await startTimerForUser(userId, req.body || {});
    res.status(201).json({ success: true, data: status });
  } catch (error) {
    handleTimerApiError(error, res, "Failed to start timer");
  }
}

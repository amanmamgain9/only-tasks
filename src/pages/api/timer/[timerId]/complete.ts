import type { NextApiRequest, NextApiResponse } from "next";
import { toWebRequest } from "@/server/api/helpers";
import { getWorkspaceUserIdFromRequest } from "@/server/auth";
import { handleTimerApiError } from "@/server/timer/api";
import { completeTimerForUser } from "@/server/timer/service";

function parseTimerId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const timerId = Number.parseInt(raw || "", 10);
  return Number.isFinite(timerId) ? timerId : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const timerId = parseTimerId(req.query.timerId);
    if (!timerId) {
      res.status(400).json({ success: false, error: "Invalid timer ID" });
      return;
    }

    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));
    const status = await completeTimerForUser(userId, timerId);
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    handleTimerApiError(error, res, "Failed to complete timer");
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { toWebRequest } from "@/server/api/helpers";
import { getWorkspaceUserIdFromRequest } from "@/server/auth";
import { handleTimerApiError } from "@/server/timer/api";
import { getTimerSettingsForUser, saveTimerSettingsForUser } from "@/server/timer/service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));

    if (req.method === "GET") {
      const settings = await getTimerSettingsForUser(userId);
      res.status(200).json({ success: true, data: settings });
      return;
    }

    const settings = await saveTimerSettingsForUser(userId, req.body || {});
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    handleTimerApiError(error, res, "Failed to save timer settings");
  }
}

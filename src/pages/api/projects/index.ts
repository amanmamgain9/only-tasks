import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { getProjectsForUser } from "@/server/projects/service";
import { toWebRequest } from "../auth/_helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getCurrentUserIdFromRequest(toWebRequest(req));
    const projects = await getProjectsForUser(userId);
    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load projects",
    });
  }
}

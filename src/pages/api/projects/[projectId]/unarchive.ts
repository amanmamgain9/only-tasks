import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { unarchiveProjectForUser } from "@/server/projects/service";
import { toWebRequest } from "../../auth/_helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const projectId = Number(req.query.projectId);
  if (!Number.isFinite(projectId)) {
    res.status(400).json({ success: false, error: "Invalid project ID" });
    return;
  }

  try {
    const userId = await getCurrentUserIdFromRequest(toWebRequest(req));
    const project = await unarchiveProjectForUser(userId, projectId);
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const message = error instanceof Error ? error.message : "Failed to unarchive project";
    res.status(message === "Project not found." ? 404 : 400).json({ success: false, error: message });
  }
}

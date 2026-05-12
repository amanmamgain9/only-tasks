import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { softDeleteProjectForUser, updateProjectForUser } from "@/server/projects/service";
import { toWebRequest } from "../auth/_helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT" && req.method !== "DELETE") {
    res.setHeader("Allow", "PUT, DELETE");
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

    if (req.method === "DELETE") {
      const project = await softDeleteProjectForUser(userId, projectId);
      res.status(200).json({ success: true, data: project });
      return;
    }

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const project = await updateProjectForUser(userId, projectId, {
      title: body.title,
      type: body.type,
      status: body.status,
      targetDate: body.targetDate,
    });

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const message = error instanceof Error ? error.message : "Failed to update project";
    res.status(message === "Project not found." ? 404 : 400).json({
      success: false,
      error: message,
    });
  }
}

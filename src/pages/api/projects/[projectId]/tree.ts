import type { NextApiRequest, NextApiResponse } from "next";
import { BillingRequiredError } from "@/server/billing/enforcement";
import { getWorkspaceUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { getProjectTree } from "@/server/tasks/service";
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
    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));
    const tasks = await getProjectTree(userId, projectId);
    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (error instanceof BillingRequiredError) {
      res.status(402).json({ success: false, error: "Active plan required" });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load task tree",
    });
  }
}

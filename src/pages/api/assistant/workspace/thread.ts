import type { NextApiRequest, NextApiResponse } from "next";
import { BillingRequiredError } from "@/server/billing/enforcement";
import { getWorkspaceUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { getWorkspaceAgentThread } from "@/server/assistant/workspaceAgent";
import { toWebRequest } from "@/server/api/helpers";

function getProjectId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));
    const data = await getWorkspaceAgentThread({
      userId,
      projectId: getProjectId(req.query.projectId),
    });
    res.status(200).json({ success: true, data });
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
      error: error instanceof Error ? error.message : "Failed to load workspace agent",
    });
  }
}

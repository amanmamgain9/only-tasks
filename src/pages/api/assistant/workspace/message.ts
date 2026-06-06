import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { BillingRequiredError } from "@/server/billing/enforcement";
import { getWorkspaceUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { submitWorkspaceAgentMessage } from "@/server/assistant/workspaceAgent";
import { toWebRequest } from "@/server/api/helpers";

const bodySchema = z.object({
  projectId: z.number().int().positive().nullable().optional(),
  prompt: z.string().trim().min(1).max(4000),
  timeZone: z.string().trim().min(1).max(128).nullable().optional(),
  currentView: z.enum(["today", "tomorrow", "this-week"]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));
    const body = bodySchema.parse(req.body);
    const data = await submitWorkspaceAgentMessage({
      userId,
      projectId: body.projectId,
      prompt: body.prompt,
      timeZone: body.timeZone,
      currentView: body.currentView,
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

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: `Invalid workspace agent payload: ${error.errors[0]?.message || "unknown error"}`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to run workspace agent",
    });
  }
}

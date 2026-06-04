import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getWorkspaceUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { toWebRequest } from "@/server/api/helpers";
import { getRecurrenceAssistantThread } from "@/server/assistant/service";
import { BillingRequiredError } from "@/server/billing/enforcement";

const querySchema = z.object({
  taskClientId: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));
    const query = querySchema.parse(req.query);
    const thread = await getRecurrenceAssistantThread({
      userId,
      taskClientId: query.taskClientId,
    });
    res.status(200).json({ success: true, data: thread });
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
      res.status(400).json({ success: false, error: error.errors[0]?.message ?? "Invalid request" });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load assistant thread",
    });
  }
}

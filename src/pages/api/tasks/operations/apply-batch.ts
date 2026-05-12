import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { BillingRequiredError } from "@/server/billing/enforcement";
import { getWorkspaceUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { operationBatchSchema } from "@/server/tasks/contracts";
import { applyOperationBatch } from "@/server/tasks/operations";
import { toWebRequest } from "../../auth/_helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));
    const batch = operationBatchSchema.parse(req.body);
    const tasks = await applyOperationBatch(batch, userId);
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

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: `Invalid operation batch: ${error.errors[0]?.message || "unknown error"}`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to apply operations",
    });
  }
}

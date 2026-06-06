import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { BillingRequiredError } from "@/server/billing/enforcement";
import { getWorkspaceUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { toWebRequest } from "@/server/api/helpers";
import { listDailyTargetsForUser, saveDailyTargetsForUser } from "@/server/dailyTargets/service";
import { TASK_CATEGORY_DEFINITIONS } from "@/features/categories/taskCategories";
import type { SaveDailyTargetsInput } from "@/features/dailyTargets/types";

const categorySchema = z.enum(TASK_CATEGORY_DEFINITIONS.map((category) => category.id) as [string, ...string[]]);
const kindSchema = z.enum(["time", "count"]);
const scheduleSchema = z.enum(["every_day", "weekdays"]);

const saveSchema = z.object({
  targets: z.array(z.object({
    category: categorySchema,
    enabled: z.boolean(),
    kind: kindSchema,
    targetMinutes: z.number().int().min(1).max(24 * 60).nullable().optional(),
    targetCount: z.number().int().min(1).max(99).nullable().optional(),
    schedule: scheduleSchema.optional(),
  })),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));

    if (req.method === "GET") {
      res.status(200).json({ success: true, data: listDailyTargetsForUser(userId) });
      return;
    }

    if (req.method === "PUT") {
      const input = saveSchema.parse(req.body) as SaveDailyTargetsInput;
      res.status(200).json({ success: true, data: saveDailyTargetsForUser(userId, input) });
      return;
    }

    res.setHeader("Allow", "GET, PUT");
    res.status(405).json({ success: false, error: "Method not allowed" });
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
        error: `Invalid daily target payload: ${error.errors[0]?.message || "unknown error"}`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load daily targets",
    });
  }
}

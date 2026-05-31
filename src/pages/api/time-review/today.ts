import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { BillingRequiredError } from "@/server/billing/enforcement";
import { getWorkspaceUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { toWebRequest } from "@/server/api/helpers";
import {
  getTodayTimeReviewForUser,
  saveTodayTimeReviewForUser,
} from "@/server/timeReview/service";

const entrySchema = z.object({
  taskId: z.number().int().positive(),
  durationMinutes: z.number().int().min(0).max(24 * 60),
  startMinute: z.number().int().min(0).max(24 * 60).nullable().optional(),
  endMinute: z.number().int().min(0).max(24 * 60).nullable().optional(),
});

const saveSchema = z.object({
  timeZone: z.string().optional().default("UTC"),
  entries: z.array(entrySchema),
  settings: z.object({
    workdayRolloverTime: z.string().optional(),
    middayReviewEnabled: z.boolean().optional(),
    middayReviewTime: z.string().nullable().optional(),
  }).optional(),
});

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getWorkspaceUserIdFromRequest(toWebRequest(req));

    if (req.method === "GET") {
      const summary = getTodayTimeReviewForUser(userId, {
        timeZone: getQueryValue(req.query.timeZone),
      });
      res.status(200).json({ success: true, data: summary });
      return;
    }

    if (req.method === "PUT") {
      const input = saveSchema.parse(req.body);
      const summary = saveTodayTimeReviewForUser(userId, input);
      res.status(200).json({ success: true, data: summary });
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
        error: `Invalid time review payload: ${error.errors[0]?.message || "unknown error"}`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load time review",
    });
  }
}

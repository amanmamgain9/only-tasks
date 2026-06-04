import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getWorkspaceUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import { toWebRequest } from "@/server/api/helpers";
import { submitRecurrenceAssistantMessage } from "@/server/assistant/service";

const bodySchema = z.object({
  taskClientId: z.string().min(1),
  prompt: z.string().trim().min(1).max(1000),
  todayDate: z.string().optional(),
  initialStartDate: z.string().nullable().optional(),
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
    const thread = await submitRecurrenceAssistantMessage({
      userId,
      taskClientId: body.taskClientId,
      prompt: body.prompt,
      todayDate: body.todayDate,
      initialStartDate: body.initialStartDate,
    });
    res.status(200).json({ success: true, data: thread });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0]?.message ?? "Invalid request" });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to send assistant message",
    });
  }
}

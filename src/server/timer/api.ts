import type { NextApiResponse } from "next";
import { z } from "zod";
import { BillingRequiredError } from "@/server/billing/enforcement";
import { UnauthorizedError } from "@/server/auth";

export function handleTimerApiError(error: unknown, res: NextApiResponse, fallbackMessage: string) {
  if (error instanceof UnauthorizedError) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  if (error instanceof BillingRequiredError) {
    res.status(402).json({ success: false, error: "Active plan required" });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, error: error.errors[0]?.message || "Invalid timer request" });
    return;
  }

  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : fallbackMessage,
  });
}

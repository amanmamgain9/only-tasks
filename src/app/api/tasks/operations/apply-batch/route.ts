import { z } from "zod";
import { getCurrentUserId } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { applyOperationBatch } from "@/server/tasks/operations";
import { operationBatchSchema } from "@/server/tasks/contracts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();
    const batch = operationBatchSchema.parse(body);
    const tasks = await applyOperationBatch(batch, userId);
    return ok(tasks);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(400, `Invalid operation batch: ${error.errors[0]?.message || "unknown error"}`);
    }

    return fail(500, error instanceof Error ? error.message : "Failed to apply operations");
  }
}

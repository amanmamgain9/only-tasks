import { getCurrentUserId } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { getScheduledTasks } from "@/server/tasks/service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dateRange: "today" | "tomorrow" | "this-week" }> },
) {
  const userId = await getCurrentUserId();
  const { dateRange } = await params;
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const projectIdNum = projectId ? Number(projectId) : undefined;

  if (!["today", "tomorrow", "this-week"].includes(dateRange)) {
    return fail(400, "Invalid dateRange value");
  }

  const tasks = await getScheduledTasks(userId, {
    dateRange,
    projectId: Number.isFinite(projectIdNum) ? projectIdNum : undefined,
  });

  return ok(tasks);
}

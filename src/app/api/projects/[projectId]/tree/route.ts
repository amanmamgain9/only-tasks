import { getCurrentUserId } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { getProjectTree } from "@/server/tasks/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await getCurrentUserId();
  const { projectId } = await params;
  const projectIdNum = Number(projectId);

  if (!Number.isFinite(projectIdNum)) {
    return fail(400, "Invalid project ID");
  }

  const tasks = await getProjectTree(userId, projectIdNum);
  return ok(tasks);
}

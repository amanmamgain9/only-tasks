import { getCurrentUserId } from "@/server/auth";
import { ok } from "@/server/http";
import { getProjectsForUser } from "@/server/projects/service";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  const projects = await getProjectsForUser(userId);
  return ok(projects);
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentUserIdFromRequest, UnauthorizedError } from "@/server/auth";
import {
  createProjectForUser,
  getProjectsForUser,
  type GetProjectsForUserOptions,
} from "@/server/projects/service";
import type { Project } from "@/server/db/schema/projects";
import { toWebRequest } from "../auth/_helpers";

const projectStatuses: Project["status"][] = ["active", "completed", "on_hold", "cancelled", "archived"];
const projectTypes: Project["type"][] = ["main", "side_project", "chore"];

function getQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseBooleanParam(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === "true";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getCurrentUserIdFromRequest(toWebRequest(req));
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const isCreateRequest = typeof body.title === "string" || typeof body.type === "string";

    if (isCreateRequest) {
      const project = await createProjectForUser(userId, {
        title: body.title,
        type: body.type,
      });
      res.status(201).json({ success: true, data: project });
      return;
    }

    const status = getQueryValue(req.query.status);
    const type = getQueryValue(req.query.type);
    const chatId = getQueryValue(req.query.chatId);

    if (status && !projectStatuses.includes(status as Project["status"])) {
      res.status(400).json({ success: false, error: "Invalid project status" });
      return;
    }

    if (type && !projectTypes.includes(type as Project["type"])) {
      res.status(400).json({ success: false, error: "Invalid project type" });
      return;
    }

    const options: GetProjectsForUserOptions = {
      includeCompleted: parseBooleanParam(getQueryValue(req.query.includeCompleted)),
      includeArchived: parseBooleanParam(getQueryValue(req.query.includeArchived)),
      includeDeleted: parseBooleanParam(getQueryValue(req.query.includeDeleted)),
      includeDrafts: parseBooleanParam(getQueryValue(req.query.includeDrafts)),
      includeChatGenerated: parseBooleanParam(getQueryValue(req.query.includeChatGenerated)),
      status: status as Project["status"] | undefined,
      type: type as Project["type"] | undefined,
      targetDateStart: getQueryValue(req.query.targetDateStart),
      targetDateEnd: getQueryValue(req.query.targetDateEnd),
    };

    if (chatId !== undefined) {
      const parsedChatId = Number.parseInt(chatId, 10);
      if (Number.isNaN(parsedChatId)) {
        res.status(400).json({ success: false, error: "Invalid chatId" });
        return;
      }
      options.chatId = parsedChatId;
    }

    const projects = await getProjectsForUser(userId, options);
    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load projects",
    });
  }
}

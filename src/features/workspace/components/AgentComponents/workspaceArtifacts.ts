import type { WorkspaceUiBlock } from "@/features/ai/types";

export type WorkspaceArtifactSource = "agent" | "quick" | "route" | "restore";

export type WorkspaceArtifact = {
  key: string;
  title: string;
  blocks: WorkspaceUiBlock[];
  pinned: boolean;
  source: WorkspaceArtifactSource;
  lastOpenedAt: number;
};

type StoredWorkspaceArtifact = {
  key: string;
  title: string;
  blocks: WorkspaceUiBlock[];
  pinned: boolean;
  lastOpenedAt: number;
};

function assertNever(value: never): never {
  throw new Error(`Unhandled workspace artifact block: ${JSON.stringify(value)}`);
}

export function workspaceBlockKey(block: WorkspaceUiBlock) {
  if (block.type === "task_tree") return `task_tree:${block.view}`;
  if (block.type === "timer") return `timer:${block.taskClientId || "workspace"}`;
  if (block.type === "progress") return `progress:${block.range}`;
  if (block.type === "day_review") return `day_review:${block.mode}`;
  if (block.type === "daily_targets") return "daily_targets:today";
  return assertNever(block);
}

export function workspaceArtifactKey(blocks: WorkspaceUiBlock[]) {
  const primary = blocks.find((block) => block.type === "task_tree")
    ?? blocks.find((block) => block.type !== "daily_targets")
    ?? blocks[0];
  return primary ? workspaceBlockKey(primary) : "artifact:empty";
}

export function workspaceBlockTitle(block: WorkspaceUiBlock) {
  if (block.title) return block.title;
  if (block.type === "task_tree") {
    if (block.view === "today") return "Today";
    if (block.view === "tomorrow") return "Tomorrow";
    if (block.view === "this_week") return "This Week";
    return "Tasks";
  }
  if (block.type === "timer") return "Timer";
  if (block.type === "day_review") return "Review";
  if (block.type === "daily_targets") return "Daily Targets";
  if (block.type === "progress") return block.range === "weekly" ? "Weekly Stats" : "Stats";
  return assertNever(block);
}

export function workspaceArtifactTitle(blocks: WorkspaceUiBlock[]) {
  const primary = blocks.find((block) => block.type === "task_tree")
    ?? blocks.find((block) => block.type !== "daily_targets")
    ?? blocks[0];
  return primary ? workspaceBlockTitle(primary) : "Artifact";
}

export function mergeWorkspaceArtifactBlocks(existingBlocks: WorkspaceUiBlock[] | undefined, nextBlocks: WorkspaceUiBlock[]) {
  if (!existingBlocks?.length || nextBlocks.length === 0) return nextBlocks;
  if (workspaceArtifactKey(existingBlocks) !== workspaceArtifactKey(nextBlocks)) return nextBlocks;
  return nextBlocks;
}

export function upsertWorkspaceArtifact(
  current: Record<string, WorkspaceArtifact>,
  blocks: WorkspaceUiBlock[],
  input: {
    pinned?: boolean;
    source: WorkspaceArtifactSource;
    now: number;
  },
) {
  const key = workspaceArtifactKey(blocks);
  const existing = current[key];
  const mergedBlocks = mergeWorkspaceArtifactBlocks(existing?.blocks, blocks);
  return {
    ...current,
    [key]: {
      key,
      title: workspaceArtifactTitle(mergedBlocks),
      blocks: mergedBlocks,
      pinned: input.pinned ?? existing?.pinned ?? false,
      source: input.source,
      lastOpenedAt: input.now,
    },
  };
}

export function serializePinnedWorkspaceArtifacts(artifacts: Record<string, WorkspaceArtifact>) {
  const pinned = Object.values(artifacts)
    .filter((artifact) => artifact.pinned)
    .map<StoredWorkspaceArtifact>((artifact) => ({
      key: artifact.key,
      title: artifact.title,
      blocks: artifact.blocks,
      pinned: true,
      lastOpenedAt: artifact.lastOpenedAt,
    }));
  return JSON.stringify({ version: 1, pinned });
}

export function restorePinnedWorkspaceArtifacts(value: string | null): Record<string, WorkspaceArtifact> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as { pinned?: StoredWorkspaceArtifact[] };
    if (!Array.isArray(parsed.pinned)) return {};

    return parsed.pinned.reduce<Record<string, WorkspaceArtifact>>((next, artifact) => {
      if (!artifact.key || !Array.isArray(artifact.blocks)) return next;
      next[artifact.key] = {
        key: artifact.key,
        title: artifact.title || workspaceArtifactTitle(artifact.blocks),
        blocks: artifact.blocks,
        pinned: true,
        source: "restore",
        lastOpenedAt: typeof artifact.lastOpenedAt === "number" ? artifact.lastOpenedAt : 0,
      };
      return next;
    }, {});
  } catch {
    return {};
  }
}

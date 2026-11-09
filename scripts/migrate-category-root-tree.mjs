import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyBetween } from "fractional-indexing";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.DATABASE_URL || path.join(projectRoot, "data", "app.db");
const targetEmails = (process.env.PMWD_CATEGORY_TREE_USERS || "demo@planmyworkday.dev")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const CATEGORY_ROOTS = [
  ["job", "Main Work", "Current job, client work, and primary professional commitments."],
  ["side_project", "Side Project", "Apps, businesses, creator work, and assets you are building outside the main job."],
  ["chore", "Chore", "Household, errands, bills, taxes, appointments, logistics, and life admin."],
  ["lifestyle", "Lifestyle", "Learning, health, social, and hobby work that blend together."],
];

const ROOT_CATEGORIES = new Set(CATEGORY_ROOTS.map(([category]) => category));
const LIFESTYLE_TRAITS = new Set(["learning", "health", "social", "hobby"]);

function ensureColumn(sqlite, tableName, columnName, definition) {
  const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) return;
  sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
}

function categoryJson(category) {
  return JSON.stringify([{ category, weight: 100 }]);
}

function lifestyleTraitJson(trait) {
  return JSON.stringify([{ trait, weight: 100 }]);
}

function parseAllocations(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePrimaryCategory(value, fallback) {
  const parsed = parseAllocations(value);
  if (parsed[0]?.category) return parsed[0].category;
  return fallback;
}

function normalizeRootCategory(category, fallback = "job") {
  if (ROOT_CATEGORIES.has(category)) return category;
  if (LIFESTYLE_TRAITS.has(category)) return "lifestyle";
  return fallback;
}

function normalizeTraitAllocations(allocations) {
  const total = allocations.reduce((sum, allocation) => sum + allocation.weight, 0);
  if (total <= 0) return [];

  const scaled = allocations.map((allocation) => ({
    ...allocation,
    weight: Math.max(1, Math.round((allocation.weight / total) * 100)),
  }));

  let diff = 100 - scaled.reduce((sum, allocation) => sum + allocation.weight, 0);
  while (diff !== 0) {
    const target = scaled
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .find((allocation) => diff > 0 || allocation.weight > 1);
    if (!target) break;
    target.weight += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }

  return scaled.filter((allocation) => allocation.weight > 0);
}

function lifestyleTraitsFromTask(task, fallbackTrait = null) {
  const existingTraits = parseAllocations(task.lifestyle_traits)
    .map((allocation) => ({
      trait: allocation.trait || allocation.category,
      weight: Number(allocation.weight ?? allocation.percentage ?? allocation.percent),
    }))
    .filter((allocation) => LIFESTYLE_TRAITS.has(allocation.trait) && Number.isFinite(allocation.weight) && allocation.weight > 0);
  if (existingTraits.length > 0) return JSON.stringify(normalizeTraitAllocations(existingTraits));

  const legacyTraits = parseAllocations(task.category_allocations)
    .map((allocation) => ({
      trait: allocation.category,
      weight: Number(allocation.weight ?? allocation.percentage ?? allocation.percent),
    }))
    .filter((allocation) => LIFESTYLE_TRAITS.has(allocation.trait) && Number.isFinite(allocation.weight) && allocation.weight > 0);
  if (legacyTraits.length > 0) return JSON.stringify(normalizeTraitAllocations(legacyTraits));

  return fallbackTrait && LIFESTYLE_TRAITS.has(fallbackTrait) ? lifestyleTraitJson(fallbackTrait) : null;
}

function categoryForProject(project, topLevelTasks) {
  const firstCategorizedTask = topLevelTasks.find((task) => task.category_allocations);
  const rawCategory = firstCategorizedTask
    ? parsePrimaryCategory(firstCategorizedTask.category_allocations, null)
    : null;
  const projectCategory = project.type === "side_project"
    ? "side_project"
    : project.type === "chore"
      ? "chore"
      : "job";
  const category = normalizeRootCategory(rawCategory, projectCategory);
  return {
    category,
    lifestyleTrait: LIFESTYLE_TRAITS.has(rawCategory) ? rawCategory : null,
  };
}

function nextPosition(sqlite, parentTaskId, projectId) {
  const last = sqlite
    .prepare(`
      SELECT position
      FROM pmwd_tasks
      WHERE project_id = ?
        AND deleted = 0
        AND ${parentTaskId === null ? "parent_task_id IS NULL" : "parent_task_id = ?"}
      ORDER BY position DESC
      LIMIT 1
    `)
    .get(...(parentTaskId === null ? [projectId] : [projectId, parentTaskId]));
  return generateKeyBetween(last?.position || null, null);
}

function getOrCreateWorkspaceProject(sqlite, userId, now) {
  const existing = sqlite
    .prepare(`
      SELECT *
      FROM pmwd_projects
      WHERE user_id = ?
        AND lower(title) = 'workspace'
        AND deleted_at IS NULL
      LIMIT 1
    `)
    .get(userId);

  if (existing) return existing;

  const result = sqlite
    .prepare(`
      INSERT INTO pmwd_projects (
        user_id, title, type, status, target_date, draft, created_by_chat_id, deleted_at, created_at, updated_at
      )
      VALUES (?, 'Workspace', 'main', 'active', NULL, 0, NULL, NULL, ?, ?)
    `)
    .run(userId, now, now);

  return sqlite.prepare("SELECT * FROM pmwd_projects WHERE id = ?").get(result.lastInsertRowid);
}

function getOrCreateCategoryRoots(sqlite, userId, workspaceProjectId, now) {
  const rootsByCategory = new Map();
  const existingRoots = sqlite
    .prepare(`
      SELECT *
      FROM pmwd_tasks
      WHERE user_id = ?
        AND project_id = ?
        AND parent_task_id IS NULL
        AND system_type = 'category_root'
        AND deleted = 0
      ORDER BY position
    `)
    .all(userId, workspaceProjectId);

  for (const root of existingRoots) {
    const category = parsePrimaryCategory(root.category_allocations, null);
    if (ROOT_CATEGORIES.has(category) && !rootsByCategory.has(category)) {
      rootsByCategory.set(category, root);
    }
  }

  let position = null;

  for (const [category, title, description] of CATEGORY_ROOTS) {
    position = generateKeyBetween(position, null);
    const existing = rootsByCategory.get(category);
    if (existing) {
      sqlite
        .prepare(`
          UPDATE pmwd_tasks
          SET title = ?, description = ?, category_allocations = ?, system_type = 'category_root',
              lifestyle_traits = NULL, position = ?, is_completed = 0, completed_at = NULL, due_date = NULL, updated_at = ?
          WHERE id = ?
        `)
        .run(title, description, categoryJson(category), position, now, existing.id);
      rootsByCategory.set(category, { ...existing, title, description, category_allocations: categoryJson(category), position });
      continue;
    }

    const result = sqlite
      .prepare(`
        INSERT INTO pmwd_tasks (
          user_id, title, description, parent_task_id, project_id, path, due_date, is_completed, priority,
          estimated_time_minutes, completed_at, category_allocations, lifestyle_traits, system_type, client_id, position,
          deleted, archived, draft, draft_chat_id, created_at, updated_at
        )
        VALUES (?, ?, ?, NULL, ?, '/', NULL, 0, NULL, NULL, NULL, ?, NULL, 'category_root', ?, ?, 0, 0, 0, NULL, ?, ?)
      `)
      .run(userId, title, description, workspaceProjectId, categoryJson(category), randomUUID(), position, now, now);

    rootsByCategory.set(category, sqlite.prepare("SELECT * FROM pmwd_tasks WHERE id = ?").get(result.lastInsertRowid));
  }

  return rootsByCategory;
}

function updateSubtree(sqlite, taskId, parentId, projectId, pathValue, now, options = {}) {
  const task = sqlite.prepare("SELECT * FROM pmwd_tasks WHERE id = ?").get(taskId);
  const category = options.category ?? null;
  const lifestyleTraits = category === "lifestyle"
    ? lifestyleTraitsFromTask(task, options.lifestyleTrait)
    : null;
  sqlite
    .prepare(`
      UPDATE pmwd_tasks
      SET parent_task_id = ?,
          project_id = ?,
          path = ?,
          category_allocations = COALESCE(?, category_allocations),
          lifestyle_traits = ?,
          updated_at = ?
      WHERE id = ?
    `)
    .run(parentId, projectId, pathValue, category ? categoryJson(category) : null, lifestyleTraits, now, taskId);

  const children = sqlite.prepare("SELECT id FROM pmwd_tasks WHERE parent_task_id = ? AND deleted = 0 ORDER BY position").all(taskId);
  const childPath = `${pathValue}${taskId}/`;
  for (const child of children) {
    updateSubtree(sqlite, child.id, taskId, projectId, childPath, now, options);
  }
}

function createHeading(sqlite, userId, projectTitle, workspaceProjectId, rootId, category, now) {
  const existing = sqlite
    .prepare(`
      SELECT *
      FROM pmwd_tasks
      WHERE user_id = ?
        AND project_id = ?
        AND parent_task_id = ?
        AND title = ?
        AND deleted = 0
      LIMIT 1
    `)
    .get(userId, workspaceProjectId, rootId, projectTitle);
  if (existing) return existing;

  const position = nextPosition(sqlite, rootId, workspaceProjectId);
  const result = sqlite
    .prepare(`
      INSERT INTO pmwd_tasks (
        user_id, title, description, parent_task_id, project_id, path, due_date, is_completed, priority,
        estimated_time_minutes, completed_at, category_allocations, lifestyle_traits, system_type, client_id, position,
        deleted, archived, draft, draft_chat_id, created_at, updated_at
      )
      VALUES (?, ?, NULL, ?, ?, ?, NULL, 0, NULL, NULL, NULL, ?, NULL, NULL, ?, ?, 0, 0, 0, NULL, ?, ?)
    `)
    .run(userId, projectTitle, rootId, workspaceProjectId, `/${rootId}/`, categoryJson(category), randomUUID(), position, now, now);

  return sqlite.prepare("SELECT * FROM pmwd_tasks WHERE id = ?").get(result.lastInsertRowid);
}

function collapseLegacyLifestyleRoots(sqlite, userId, workspaceProjectId, rootsByCategory, now) {
  const lifestyleRoot = rootsByCategory.get("lifestyle");
  if (!lifestyleRoot) return 0;

  const legacyRoots = sqlite
    .prepare(`
      SELECT *
      FROM pmwd_tasks
      WHERE user_id = ?
        AND project_id = ?
        AND parent_task_id IS NULL
        AND system_type = 'category_root'
        AND deleted = 0
      ORDER BY position
    `)
    .all(userId, workspaceProjectId)
    .filter((root) => LIFESTYLE_TRAITS.has(parsePrimaryCategory(root.category_allocations, null)));

  let moved = 0;
  for (const legacyRoot of legacyRoots) {
    if (legacyRoot.id === lifestyleRoot.id) continue;
    const fallbackTrait = parsePrimaryCategory(legacyRoot.category_allocations, null);
    const children = sqlite
      .prepare("SELECT * FROM pmwd_tasks WHERE parent_task_id = ? AND deleted = 0 ORDER BY position, id")
      .all(legacyRoot.id);

    for (const child of children) {
      const position = nextPosition(sqlite, lifestyleRoot.id, workspaceProjectId);
      sqlite.prepare("UPDATE pmwd_tasks SET position = ?, updated_at = ? WHERE id = ?").run(position, now, child.id);
      updateSubtree(sqlite, child.id, lifestyleRoot.id, workspaceProjectId, `/${lifestyleRoot.id}/`, now, {
        category: "lifestyle",
        lifestyleTrait: fallbackTrait,
      });
      moved += 1;
    }

    sqlite
      .prepare("UPDATE pmwd_tasks SET deleted = 1, archived = 1, updated_at = ? WHERE id = ?")
      .run(now, legacyRoot.id);
  }

  return moved;
}

function migrateUser(sqlite, user) {
  const now = new Date().toISOString();
  const workspaceProject = getOrCreateWorkspaceProject(sqlite, user.id, now);
  const rootsByCategory = getOrCreateCategoryRoots(sqlite, user.id, workspaceProject.id, now);
  const collapsedLifestyleRoots = collapseLegacyLifestyleRoots(sqlite, user.id, workspaceProject.id, rootsByCategory, now);
  const projects = sqlite
    .prepare(`
      SELECT *
      FROM pmwd_projects
      WHERE user_id = ?
        AND deleted_at IS NULL
      ORDER BY id
    `)
    .all(user.id);

  let movedRoots = 0;
  for (const project of projects) {
    if (project.id === workspaceProject.id) continue;

    const topLevelTasks = sqlite
      .prepare(`
        SELECT *
        FROM pmwd_tasks
        WHERE user_id = ?
          AND project_id = ?
          AND parent_task_id IS NULL
          AND deleted = 0
          AND COALESCE(system_type, '') != 'category_root'
        ORDER BY position, id
      `)
      .all(user.id, project.id);

    if (topLevelTasks.length === 0) {
      sqlite.prepare("UPDATE pmwd_projects SET status = 'archived', updated_at = ? WHERE id = ?").run(now, project.id);
      continue;
    }

    const { category, lifestyleTrait } = categoryForProject(project, topLevelTasks);
    const root = rootsByCategory.get(category) || rootsByCategory.get("job");
    const useHeading = category === "job" || category === "side_project";
    const parent = useHeading
      ? createHeading(sqlite, user.id, project.title, workspaceProject.id, root.id, category, now)
      : root;

    for (const task of topLevelTasks) {
      updateSubtree(sqlite, task.id, parent.id, workspaceProject.id, `/${parent.id}/`, now, {
        category,
        lifestyleTrait,
      });
      movedRoots += 1;
    }

    sqlite.prepare("UPDATE pmwd_projects SET status = 'archived', updated_at = ? WHERE id = ?").run(now, project.id);
  }

  sqlite
    .prepare(`
      UPDATE pmwd_task_time_reviews
      SET project_id = ?
      WHERE user_id = ?
    `)
    .run(workspaceProject.id, user.id);

  return {
    email: user.email,
    workspaceProjectId: workspaceProject.id,
    movedTopLevelTasks: movedRoots,
    collapsedLifestyleRoots,
  };
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
ensureColumn(sqlite, "pmwd_tasks", "system_type", "system_type TEXT");
ensureColumn(sqlite, "pmwd_tasks", "lifestyle_traits", "lifestyle_traits TEXT");

const migrate = sqlite.transaction(() => {
  const users = sqlite
    .prepare(`SELECT * FROM users WHERE lower(email) IN (${targetEmails.map(() => "?").join(",")}) ORDER BY id`)
    .all(...targetEmails);
  return users.map((user) => migrateUser(sqlite, user));
});

const results = migrate();
console.log(JSON.stringify({ dbPath, users: results }, null, 2));

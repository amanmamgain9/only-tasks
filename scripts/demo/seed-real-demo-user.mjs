#!/usr/bin/env node

import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const dbPath = process.env.DATABASE_URL || path.join(projectRoot, "data", "app.db");
const email = (process.env.PMWD_DEMO_EMAIL || "demo@planmyworkday.dev").trim().toLowerCase();
const name = process.env.PMWD_DEMO_NAME || "Plan My Workday Demo";
const shouldReset = !process.argv.includes("--keep-existing");
const authOut = path.join(scriptDir, ".demo-auth.json");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isoDate(offsetDays = 0) {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString();
}

function isoAt(offsetDays = 0, hour = 10, minute = 0) {
  const value = new Date();
  value.setUTCHours(hour, minute, 0, 0);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString();
}

function getExistingColumns(sqlite, tableName) {
  return new Set(sqlite.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => row.name));
}

function ensureColumn(sqlite, tableName, columnName, definition) {
  const columns = getExistingColumns(sqlite, tableName);
  if (!columns.has(columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

function ensureSchema(sqlite) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      image TEXT,
      google_id TEXT,
      profile_picture TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'google',
      last_login_at TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT,
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'manual',
      plan_key TEXT,
      legacy_plan_id INTEGER,
      current_period_starts_at TEXT,
      current_period_ends_at TEXT,
      next_billed_at TEXT,
      canceled_at TEXT,
      auto_renew INTEGER NOT NULL DEFAULT 1,
      paddle_customer_id TEXT,
      paddle_subscription_id TEXT,
      paddle_price_id TEXT,
      paddle_updated_at TEXT,
      legacy_paypal_subscription_id TEXT,
      legacy_lemonsqueezy_subscription_id TEXT,
      requires_billing_migration_review INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'native',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pmwd_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'main',
      status TEXT NOT NULL DEFAULT 'active',
      target_date TEXT,
      draft INTEGER NOT NULL DEFAULT 0,
      created_by_chat_id INTEGER,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pmwd_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      parent_task_id INTEGER,
      project_id INTEGER,
      path TEXT NOT NULL DEFAULT '/',
      due_date TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      priority INTEGER,
      estimated_time_minutes INTEGER,
      completed_at TEXT,
      category_allocations TEXT,
      lifestyle_traits TEXT,
      system_type TEXT,
      client_id TEXT,
      position TEXT NOT NULL DEFAULT 'a0',
      deleted INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      draft INTEGER NOT NULL DEFAULT 0,
      draft_chat_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_task_id) REFERENCES pmwd_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES pmwd_projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS pmwd_timer_settings (
      user_id INTEGER PRIMARY KEY,
      focus_duration_minutes INTEGER NOT NULL DEFAULT 25,
      short_break_duration_minutes INTEGER NOT NULL DEFAULT 5,
      long_break_duration_minutes INTEGER NOT NULL DEFAULT 15,
      sessions_before_long_break INTEGER NOT NULL DEFAULT 4,
      sound_enabled INTEGER NOT NULL DEFAULT 1,
      selected_sound TEXT NOT NULL DEFAULT 'chime',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pmwd_timer_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_id INTEGER,
      project_id INTEGER,
      phase TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'running',
      work_session_number INTEGER NOT NULL DEFAULT 1,
      duration_seconds INTEGER NOT NULL,
      accumulated_ms INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      last_resumed_at TEXT,
      paused_at TEXT,
      ended_at TEXT,
      client_mutation_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES pmwd_tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES pmwd_projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS pmwd_workday_settings (
      user_id INTEGER PRIMARY KEY,
      workday_rollover_time TEXT NOT NULL DEFAULT '00:00',
      midday_review_enabled INTEGER NOT NULL DEFAULT 1,
      midday_review_time TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pmwd_task_time_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      project_id INTEGER,
      workday_date TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      start_minute INTEGER,
      end_minute INTEGER,
      source TEXT NOT NULL DEFAULT 'manual_review',
      review_status TEXT NOT NULL DEFAULT 'draft',
      review_window TEXT NOT NULL DEFAULT 'same_workday_end',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES pmwd_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES pmwd_projects(id) ON DELETE SET NULL
    );
  `);

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS pmwd_task_time_reviews_user_task_workday_unique
    ON pmwd_task_time_reviews(user_id, task_id, workday_date);
  `);

  ensureColumn(sqlite, "pmwd_tasks", "completed_at", "completed_at TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "category_allocations", "category_allocations TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "lifestyle_traits", "lifestyle_traits TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "system_type", "system_type TEXT");
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
ensureSchema(sqlite);

const now = new Date().toISOString();

const run = sqlite.transaction(() => {
  let user = sqlite.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user) {
    const result = sqlite
      .prepare(`
        INSERT INTO users (email, name, image, google_id, profile_picture, auth_provider, last_login_at, is_admin, created_at, updated_at)
        VALUES (?, ?, NULL, ?, NULL, 'demo', ?, 1, ?, ?)
      `)
      .run(email, name, `demo:${email}`, now, now, now);
    user = sqlite.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  } else {
    sqlite
      .prepare("UPDATE users SET name = ?, auth_provider = 'demo', last_login_at = ?, is_admin = 1, updated_at = ? WHERE id = ?")
      .run(name, now, now, user.id);
  }

  if (shouldReset) {
    sqlite.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(user.id);
    sqlite.prepare("DELETE FROM subscriptions WHERE user_id = ?").run(user.id);
    sqlite.prepare("DELETE FROM pmwd_task_time_reviews WHERE user_id = ?").run(user.id);
    sqlite.prepare("DELETE FROM pmwd_workday_settings WHERE user_id = ?").run(user.id);
    sqlite.prepare("DELETE FROM pmwd_tasks WHERE user_id = ?").run(user.id);
    sqlite.prepare("DELETE FROM pmwd_projects WHERE user_id = ?").run(user.id);
    sqlite.prepare("DELETE FROM pmwd_timer_sessions WHERE user_id = ?").run(user.id);
    sqlite.prepare("DELETE FROM pmwd_timer_settings WHERE user_id = ?").run(user.id);
  }

  sqlite
    .prepare(`
      INSERT INTO subscriptions (
        user_id, status, provider, plan_key, current_period_starts_at, current_period_ends_at, next_billed_at,
        canceled_at, auto_renew, requires_billing_migration_review, source, created_at, updated_at
      )
      VALUES (?, 'active', 'manual', 'lifetime', ?, NULL, NULL, NULL, 0, 0, 'demo_seed', ?, ?)
    `)
    .run(user.id, now, now, now);

  sqlite
    .prepare(`
      INSERT OR REPLACE INTO pmwd_timer_settings (
        user_id, focus_duration_minutes, short_break_duration_minutes, long_break_duration_minutes,
        sessions_before_long_break, sound_enabled, selected_sound, created_at, updated_at
      )
      VALUES (?, 25, 5, 15, 4, 1, 'chime', ?, ?)
    `)
    .run(user.id, now, now);

  sqlite
    .prepare(`
      INSERT OR REPLACE INTO pmwd_workday_settings (
        user_id, workday_rollover_time, midday_review_enabled, midday_review_time, created_at, updated_at
      )
      VALUES (?, '02:00', 1, '12:00', ?, ?)
    `)
    .run(user.id, now, now);

  const insertProject = sqlite.prepare(`
    INSERT INTO pmwd_projects (user_id, title, type, status, target_date, draft, created_by_chat_id, deleted_at, created_at, updated_at)
    VALUES (?, ?, ?, 'active', NULL, 0, NULL, NULL, ?, ?)
  `);

  const mainWorkProjectId = insertProject.run(user.id, "Client Work", "main", now, now).lastInsertRowid;
  const launchProjectId = insertProject.run(user.id, "Launch", "side_project", now, now).lastInsertRowid;
  const contentProjectId = insertProject.run(user.id, "Content", "side_project", now, now).lastInsertRowid;
  const adminProjectId = insertProject.run(user.id, "Admin", "chore", now, now).lastInsertRowid;
  const lifestyleProjectId = insertProject.run(user.id, "Lifestyle", "main", now, now).lastInsertRowid;
  const categoryDefaultsByProject = new Map([
    [mainWorkProjectId, [{ category: "job", weight: 100 }]],
    [launchProjectId, [{ category: "side_project", weight: 100 }]],
    [contentProjectId, [{ category: "side_project", weight: 70 }, { category: "lifestyle", weight: 30 }]],
    [adminProjectId, [{ category: "chore", weight: 100 }]],
    [lifestyleProjectId, [{ category: "lifestyle", weight: 100 }]],
  ]);
  const lifestyleDefaultsByProject = new Map([
    [contentProjectId, [{ trait: "learning", weight: 70 }, { trait: "hobby", weight: 30 }]],
    [lifestyleProjectId, [{ trait: "health", weight: 45 }, { trait: "social", weight: 30 }, { trait: "hobby", weight: 25 }]],
  ]);

  function categoryAllocationsFor(projectId, categoryAllocations = null) {
    return categoryAllocations || categoryDefaultsByProject.get(projectId) || [{ category: "job", weight: 100 }];
  }

  function categoryJson(projectId, categoryAllocations = null) {
    return JSON.stringify(categoryAllocationsFor(projectId, categoryAllocations));
  }

  function lifestyleTraitJson(projectId, categoryAllocations = null, lifestyleTraits = null) {
    const categories = categoryAllocationsFor(projectId, categoryAllocations);
    if (!categories.some((allocation) => allocation.category === "lifestyle")) return null;
    return JSON.stringify(lifestyleTraits || lifestyleDefaultsByProject.get(projectId) || [{ trait: "learning", weight: 100 }]);
  }

  const insertTask = sqlite.prepare(`
    INSERT INTO pmwd_tasks (
      user_id, title, description, parent_task_id, project_id, path, due_date, is_completed, priority,
      estimated_time_minutes, completed_at, category_allocations, lifestyle_traits, system_type, client_id, position, deleted, archived, draft, draft_chat_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, 0, 0, NULL, ?, ?)
  `);

  function task({
    title,
    description = null,
    parentId = null,
    projectId,
    pathValue = "/",
    dueDate = null,
    done = false,
    priority = null,
    minutes = null,
    position,
    completedAt = null,
    createdAt = null,
    updatedAt = null,
    categoryAllocations = null,
    lifestyleTraits = null,
  }) {
    const finalCompletedAt = done ? (completedAt || now) : null;
    const finalCreatedAt = createdAt || finalCompletedAt || now;
    const finalUpdatedAt = updatedAt || finalCompletedAt || now;

    return insertTask.run(
      user.id,
      title,
      description,
      parentId,
      projectId,
      pathValue,
      dueDate,
      done ? 1 : 0,
      priority,
      minutes,
      finalCompletedAt,
      categoryJson(projectId, categoryAllocations),
      lifestyleTraitJson(projectId, categoryAllocations, lifestyleTraits),
      randomUUID(),
      position,
      finalCreatedAt,
      finalUpdatedAt,
    ).lastInsertRowid;
  }

  const insertTimerSession = sqlite.prepare(`
    INSERT INTO pmwd_timer_sessions (
      user_id, task_id, project_id, phase, state, work_session_number, duration_seconds, accumulated_ms,
      started_at, last_resumed_at, paused_at, ended_at, client_mutation_id, created_at, updated_at
    )
    VALUES (?, ?, ?, 'work', ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
  `);

  const insertTimeReview = sqlite.prepare(`
    INSERT INTO pmwd_task_time_reviews (
      user_id, task_id, project_id, workday_date, duration_minutes, start_minute, end_minute,
      source, review_status, review_window, notes, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual_review', 'confirmed', ?, NULL, ?, ?)
    ON CONFLICT(user_id, task_id, workday_date) DO UPDATE SET
      duration_minutes = excluded.duration_minutes,
      start_minute = excluded.start_minute,
      end_minute = excluded.end_minute,
      review_status = excluded.review_status,
      review_window = excluded.review_window,
      updated_at = excluded.updated_at
  `);

  function timeReview({
    taskId,
    projectId,
    offsetDays = 0,
    durationMinutes,
    startMinute,
    reviewWindow = "same_workday_end",
  }) {
    insertTimeReview.run(
      user.id,
      taskId,
      projectId,
      isoDate(offsetDays).slice(0, 10),
      durationMinutes,
      startMinute,
      Math.min(1440, startMinute + durationMinutes),
      reviewWindow,
      now,
      now,
    );
  }

  function timerSession({
    taskId = null,
    projectId,
    offsetDays,
    hour,
    minute = 0,
    durationMinutes = 25,
    actualMinutes = durationMinutes,
    state = "completed",
    sessionNumber = 1,
  }) {
    const endedAt = isoAt(offsetDays, hour, minute);
    const startedAt = new Date(new Date(endedAt).getTime() - actualMinutes * 60 * 1000).toISOString();

    insertTimerSession.run(
      user.id,
      taskId,
      projectId,
      state,
      sessionNumber,
      durationMinutes * 60,
      actualMinutes * 60 * 1000,
      startedAt,
      startedAt,
      endedAt,
      randomUUID(),
      startedAt,
      endedAt,
    );
  }

  const clientPromptId = task({
    title: "Update client prompts",
    description: "Make the prompt set clearer before the next client review.",
    projectId: mainWorkProjectId,
    dueDate: isoDate(0),
    done: true,
    priority: 1,
    minutes: 90,
    position: "a0",
    completedAt: isoAt(0, 3, 30),
  });

  task({
    title: "Review contract notes",
    projectId: mainWorkProjectId,
    dueDate: isoDate(0),
    priority: 2,
    minutes: 35,
    position: "a1",
  });

  const cleanCopyId = task({
    title: "Clean public feature copy",
    description: "Marketing copy matches the shipped workspace.",
    projectId: launchProjectId,
    dueDate: isoDate(0),
    done: true,
    priority: 3,
    minutes: 20,
    position: "a0",
    completedAt: isoAt(0, 4, 40),
  });

  const walkthroughId = task({
    title: "Record homepage walkthrough",
    description: "Show tasks, date views, timer, and focus mode in one pass.",
    projectId: launchProjectId,
    dueDate: isoDate(0),
    priority: 1,
    minutes: 45,
    position: "a1",
  });

  task({
    title: "Show keyboard navigation slowly",
    parentId: walkthroughId,
    projectId: launchProjectId,
    pathValue: `/${walkthroughId}/`,
    dueDate: isoDate(0),
    priority: 1,
    minutes: 10,
    position: "a0",
  });

  task({
    title: "Open focus mode from timer",
    parentId: walkthroughId,
    projectId: launchProjectId,
    pathValue: `/${walkthroughId}/`,
    dueDate: isoDate(0),
    priority: 2,
    minutes: 10,
    position: "a1",
  });

  task({
    title: "Export demo video and poster",
    parentId: walkthroughId,
    projectId: launchProjectId,
    pathValue: `/${walkthroughId}/`,
    dueDate: isoDate(1),
    priority: 2,
    minutes: 15,
    position: "a2",
  });

  task({
    title: "",
    description: "Blank row for the real capture script to type into.",
    projectId: launchProjectId,
    dueDate: null,
    priority: 3,
    minutes: 10,
    position: "a2",
  });

  task({
    title: "Verify billing and profile flow",
    projectId: launchProjectId,
    dueDate: isoDate(3),
    priority: 2,
    minutes: 25,
    position: "a3",
  });

  const homepageId = task({
    title: "Review homepage screenshots",
    projectId: contentProjectId,
    dueDate: isoDate(1),
    priority: 2,
    minutes: 30,
    position: "a0",
  });

  task({
    title: "Compare desktop and mobile hero",
    parentId: homepageId,
    projectId: contentProjectId,
    pathValue: `/${homepageId}/`,
    dueDate: isoDate(1),
    priority: 2,
    minutes: 15,
    position: "a0",
  });

  task({
    title: "Write launch announcement",
    projectId: contentProjectId,
    dueDate: isoDate(4),
    priority: 3,
    minutes: 40,
    position: "a1",
  });

  const gstFilingId = task({
    title: "GST filing",
    projectId: adminProjectId,
    dueDate: isoDate(0),
    done: true,
    priority: 1,
    minutes: 45,
    position: "a0",
    completedAt: isoAt(0, 5, 35),
  });

  task({
    title: "Check production deployment",
    projectId: adminProjectId,
    dueDate: isoDate(0),
    priority: 1,
    minutes: 20,
    position: "a1",
  });

  task({
    title: "Confirm Paddle copy and checkout",
    projectId: adminProjectId,
    dueDate: isoDate(1),
    priority: 2,
    minutes: 30,
    position: "a2",
  });

  const morningMovementId = task({
    title: "Morning mobility and padel drills",
    projectId: lifestyleProjectId,
    dueDate: isoDate(0),
    done: true,
    priority: 2,
    minutes: 50,
    position: "a0",
    completedAt: isoAt(0, 2, 45),
    lifestyleTraits: [
      { trait: "health", weight: 65 },
      { trait: "hobby", weight: 25 },
      { trait: "social", weight: 10 },
    ],
  });

  task({
    title: "Padel with friends",
    projectId: lifestyleProjectId,
    dueDate: isoDate(0),
    priority: 3,
    minutes: 60,
    position: "a1",
    lifestyleTraits: [
      { trait: "health", weight: 45 },
      { trait: "social", weight: 35 },
      { trait: "hobby", weight: 20 },
    ],
  });

  task({
    title: "Read product psychology notes",
    projectId: lifestyleProjectId,
    dueDate: isoDate(2),
    priority: 3,
    minutes: 35,
    position: "a2",
    lifestyleTraits: [
      { trait: "learning", weight: 75 },
      { trait: "hobby", weight: 25 },
    ],
  });

  const historicalTaskSpecs = [
    {
      title: "Ship client prompt refresh",
      projectId: mainWorkProjectId,
      dueDate: isoDate(-6),
      completedAt: isoAt(-6, 4, 55),
      priority: 1,
      minutes: 85,
      position: "a2",
    },
    {
      title: "Define progress dashboard metrics",
      projectId: launchProjectId,
      dueDate: isoDate(-6),
      completedAt: isoAt(-6, 6, 10),
      priority: 1,
      minutes: 35,
      position: "a4",
    },
    {
      title: "Fix keyboard route focus regression",
      projectId: launchProjectId,
      dueDate: isoDate(-5),
      completedAt: isoAt(-5, 8, 25),
      priority: 1,
      minutes: 45,
      position: "a5",
    },
    {
      title: "Draft progress marketing notes",
      projectId: contentProjectId,
      dueDate: isoDate(-4),
      completedAt: isoAt(-4, 5, 50),
      priority: 2,
      minutes: 30,
      position: "a4",
    },
    {
      title: "Review mobile sidebar spacing",
      projectId: launchProjectId,
      dueDate: isoDate(-3),
      completedAt: isoAt(-3, 9, 5),
      priority: 2,
      minutes: 25,
      position: "a6",
    },
    {
      title: "Publish timer focus notes",
      projectId: contentProjectId,
      dueDate: isoDate(-2),
      completedAt: isoAt(-2, 7, 35),
      priority: 3,
      minutes: 40,
      position: "a5",
    },
    {
      title: "Prepare review account data",
      projectId: adminProjectId,
      dueDate: isoDate(-1),
      completedAt: isoAt(-1, 11, 15),
      priority: 2,
      minutes: 30,
      position: "a2",
    },
    {
      title: "Dance class with friends",
      projectId: lifestyleProjectId,
      dueDate: isoDate(-1),
      completedAt: isoAt(-1, 13, 10),
      priority: 3,
      minutes: 55,
      position: "a3",
      lifestyleTraits: [
        { trait: "health", weight: 45 },
        { trait: "social", weight: 35 },
        { trait: "hobby", weight: 20 },
      ],
    },
    {
      title: "Verify weekly progress totals",
      projectId: launchProjectId,
      dueDate: isoDate(0),
      completedAt: isoAt(0, 6, 5),
      priority: 1,
      minutes: 25,
      position: "a7",
    },
  ];
  const historicalTasks = historicalTaskSpecs.map((item) => ({
    ...item,
    id: task({ ...item, done: true, createdAt: isoAt(item.dueDate === isoDate(0) ? 0 : -8, 3, 0) }),
  }));
  const historicalTaskIdByTitle = new Map(historicalTasks.map((item) => [item.title, item.id]));

  task({
    title: "Add progress view to homepage demo",
    projectId: contentProjectId,
    dueDate: isoDate(2),
    priority: 2,
    minutes: 35,
    position: "a6",
  });

  timerSession({ taskId: historicalTaskIdByTitle.get("Ship client prompt refresh"), projectId: mainWorkProjectId, offsetDays: -6, hour: 5, minute: 0, durationMinutes: 50, sessionNumber: 1 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Define progress dashboard metrics"), projectId: launchProjectId, offsetDays: -6, hour: 6, minute: 20, sessionNumber: 2 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Fix keyboard route focus regression"), projectId: launchProjectId, offsetDays: -5, hour: 8, minute: 30, sessionNumber: 3 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Fix keyboard route focus regression"), projectId: launchProjectId, offsetDays: -5, hour: 9, minute: 10, sessionNumber: 4 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Draft progress marketing notes"), projectId: contentProjectId, offsetDays: -4, hour: 6, minute: 0, sessionNumber: 5 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Review mobile sidebar spacing"), projectId: launchProjectId, offsetDays: -3, hour: 9, minute: 20, sessionNumber: 6 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Review mobile sidebar spacing"), projectId: launchProjectId, offsetDays: -3, hour: 10, minute: 5, sessionNumber: 7 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Review mobile sidebar spacing"), projectId: launchProjectId, offsetDays: -3, hour: 10, minute: 45, sessionNumber: 8 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Publish timer focus notes"), projectId: contentProjectId, offsetDays: -2, hour: 7, minute: 45, sessionNumber: 9 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Prepare review account data"), projectId: adminProjectId, offsetDays: -1, hour: 11, minute: 20, sessionNumber: 10 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Dance class with friends"), projectId: lifestyleProjectId, offsetDays: -1, hour: 13, minute: 20, durationMinutes: 45, sessionNumber: 11 });
  timerSession({ taskId: clientPromptId, projectId: mainWorkProjectId, offsetDays: 0, hour: 3, minute: 35, durationMinutes: 50, sessionNumber: 12 });
  timerSession({ taskId: cleanCopyId, projectId: launchProjectId, offsetDays: 0, hour: 4, minute: 45, sessionNumber: 13 });
  timerSession({ taskId: historicalTaskIdByTitle.get("Verify weekly progress totals"), projectId: launchProjectId, offsetDays: 0, hour: 6, minute: 10, sessionNumber: 14 });

  timeReview({ taskId: clientPromptId, projectId: mainWorkProjectId, offsetDays: 0, durationMinutes: 95, startMinute: 8 * 60, reviewWindow: "same_workday_midday" });
  timeReview({ taskId: cleanCopyId, projectId: launchProjectId, offsetDays: 0, durationMinutes: 35, startMinute: 9 * 60, reviewWindow: "same_workday_midday" });
  timeReview({ taskId: historicalTaskIdByTitle.get("Verify weekly progress totals"), projectId: launchProjectId, offsetDays: 0, durationMinutes: 25, startMinute: 10 * 60, reviewWindow: "same_workday_midday" });
  timeReview({ taskId: gstFilingId, projectId: adminProjectId, offsetDays: 0, durationMinutes: 40, startMinute: 11 * 60, reviewWindow: "same_workday_midday" });
  timeReview({ taskId: morningMovementId, projectId: lifestyleProjectId, offsetDays: 0, durationMinutes: 45, startMinute: 7 * 60, reviewWindow: "same_workday_midday" });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  sqlite
    .prepare(`
      INSERT INTO auth_sessions (user_id, token_hash, expires_at, created_at, updated_at, last_seen_at, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, 'pmwd-demo-capture', '127.0.0.1')
    `)
    .run(user.id, sha256(token), expiresAt, now, now, now);

  return {
    userId: user.id,
    email,
    name,
    token,
    expiresAt,
    projects: {
      mainWork: mainWorkProjectId,
      launch: launchProjectId,
      content: contentProjectId,
      admin: adminProjectId,
      lifestyle: lifestyleProjectId,
    },
  };
});

const result = run();
const migrationResult = JSON.parse(execFileSync(
  process.execPath,
  [path.join(projectRoot, "scripts/migrate-category-root-tree.mjs")],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      PMWD_CATEGORY_TREE_USERS: email,
    },
    encoding: "utf8",
  },
));
await mkdir(scriptDir, { recursive: true });
await writeFile(authOut, `${JSON.stringify(result, null, 2)}\n`);

console.log(JSON.stringify({
  database: dbPath,
  auth: path.relative(projectRoot, authOut),
  email: result.email,
  userId: result.userId,
  workspaceProjectId: migrationResult.users?.[0]?.workspaceProjectId,
  projects: result.projects,
}, null, 2));

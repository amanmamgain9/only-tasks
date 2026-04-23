import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function initializeDatabase(sqlite: Database.Database) {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      image TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
  `);
}

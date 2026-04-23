import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

function getExistingColumns(sqlite: Database.Database, tableName: string) {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function ensureColumn(
  sqlite: Database.Database,
  tableName: string,
  columnName: string,
  sqlDefinition: string,
) {
  const columns = getExistingColumns(sqlite, tableName);
  if (columns.has(columnName)) return;
  sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${sqlDefinition}`);
}

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
      google_id TEXT,
      profile_picture TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'google',
      last_login_at TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique
    ON users(google_id)
    WHERE google_id IS NOT NULL;

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

    CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);

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
      legacy_paypal_subscription_id TEXT,
      legacy_lemonsqueezy_subscription_id TEXT,
      requires_billing_migration_review INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'native',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_paddle_subscription_id_unique
    ON subscriptions(paddle_subscription_id)
    WHERE paddle_subscription_id IS NOT NULL;
  `);

  ensureColumn(sqlite, "users", "google_id", "google_id TEXT");
  ensureColumn(sqlite, "users", "profile_picture", "profile_picture TEXT");
  ensureColumn(sqlite, "users", "auth_provider", "auth_provider TEXT NOT NULL DEFAULT 'google'");
  ensureColumn(sqlite, "users", "last_login_at", "last_login_at TEXT");
  ensureColumn(sqlite, "users", "is_admin", "is_admin INTEGER NOT NULL DEFAULT 0");
}

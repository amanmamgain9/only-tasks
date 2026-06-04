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
      original_due_date TEXT,
      rollover_history TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      priority INTEGER,
      estimated_time_minutes INTEGER,
      completed_at TEXT,
      category_allocations TEXT,
      lifestyle_traits TEXT,
      system_type TEXT,
      recurrence_series_id INTEGER,
      recurrence_role TEXT,
      recurrence_template_task_id INTEGER,
      recurrence_occurrence_date TEXT,
      recurrence_status TEXT,
      recurrence_is_override INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS pmwd_task_recurrence_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      template_task_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      rule TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (template_task_id) REFERENCES pmwd_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pmwd_task_recurrence_completion_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recurrence_series_id INTEGER NOT NULL,
      template_task_id INTEGER NOT NULL,
      local_date TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      completed_at TEXT NOT NULL,
      client_event_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recurrence_series_id) REFERENCES pmwd_task_recurrence_series(id) ON DELETE CASCADE,
      FOREIGN KEY (template_task_id) REFERENCES pmwd_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pmwd_assistant_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      surface TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      entity_client_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pmwd_assistant_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      structured_payload TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES pmwd_assistant_threads(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
      paddle_updated_at TEXT,
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

    CREATE INDEX IF NOT EXISTS pmwd_timer_sessions_user_id_idx
    ON pmwd_timer_sessions(user_id);

    CREATE INDEX IF NOT EXISTS pmwd_timer_sessions_task_id_idx
    ON pmwd_timer_sessions(task_id);

    CREATE UNIQUE INDEX IF NOT EXISTS pmwd_timer_sessions_one_active_per_user_unique
    ON pmwd_timer_sessions(user_id)
    WHERE state IN ('running', 'paused');

    CREATE UNIQUE INDEX IF NOT EXISTS pmwd_timer_sessions_user_mutation_unique
    ON pmwd_timer_sessions(user_id, client_mutation_id)
    WHERE client_mutation_id IS NOT NULL;

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

    CREATE UNIQUE INDEX IF NOT EXISTS pmwd_task_time_reviews_user_task_workday_unique
    ON pmwd_task_time_reviews(user_id, task_id, workday_date);

    CREATE INDEX IF NOT EXISTS pmwd_task_time_reviews_user_workday_idx
    ON pmwd_task_time_reviews(user_id, workday_date);

    CREATE TABLE IF NOT EXISTS billing_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'paddle',
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      processing_status TEXT NOT NULL DEFAULT 'received',
      raw_body TEXT,
      error_message TEXT,
      occurred_at TEXT,
      processed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS billing_events_provider_event_id_unique
    ON billing_events(provider, event_id);

    CREATE INDEX IF NOT EXISTS billing_events_processing_status_idx
    ON billing_events(processing_status);
  `);

  ensureColumn(sqlite, "users", "google_id", "google_id TEXT");
  ensureColumn(sqlite, "users", "profile_picture", "profile_picture TEXT");
  ensureColumn(sqlite, "users", "auth_provider", "auth_provider TEXT NOT NULL DEFAULT 'google'");
  ensureColumn(sqlite, "users", "last_login_at", "last_login_at TEXT");
  ensureColumn(sqlite, "users", "is_admin", "is_admin INTEGER NOT NULL DEFAULT 0");
  ensureColumn(sqlite, "pmwd_tasks", "completed_at", "completed_at TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "original_due_date", "original_due_date TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "rollover_history", "rollover_history TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "category_allocations", "category_allocations TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "lifestyle_traits", "lifestyle_traits TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "system_type", "system_type TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "recurrence_series_id", "recurrence_series_id INTEGER");
  ensureColumn(sqlite, "pmwd_tasks", "recurrence_role", "recurrence_role TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "recurrence_template_task_id", "recurrence_template_task_id INTEGER");
  ensureColumn(sqlite, "pmwd_tasks", "recurrence_occurrence_date", "recurrence_occurrence_date TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "recurrence_status", "recurrence_status TEXT");
  ensureColumn(sqlite, "pmwd_tasks", "recurrence_is_override", "recurrence_is_override INTEGER NOT NULL DEFAULT 0");
  ensureColumn(sqlite, "subscriptions", "paddle_updated_at", "paddle_updated_at TEXT");

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS pmwd_task_recurrence_series_active_template_unique
    ON pmwd_task_recurrence_series(user_id, template_task_id)
    WHERE status = 'active';

    CREATE INDEX IF NOT EXISTS pmwd_task_recurrence_series_user_status_idx
    ON pmwd_task_recurrence_series(user_id, status);

    CREATE INDEX IF NOT EXISTS pmwd_task_recurrence_completion_events_series_date_idx
    ON pmwd_task_recurrence_completion_events(user_id, recurrence_series_id, local_date);

    CREATE UNIQUE INDEX IF NOT EXISTS pmwd_task_recurrence_completion_events_client_event_unique
    ON pmwd_task_recurrence_completion_events(user_id, client_event_id)
    WHERE client_event_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS pmwd_tasks_recurrence_template_date_unique
    ON pmwd_tasks(user_id, recurrence_template_task_id, recurrence_occurrence_date)
    WHERE recurrence_template_task_id IS NOT NULL
      AND recurrence_occurrence_date IS NOT NULL
      AND deleted = 0;

    CREATE INDEX IF NOT EXISTS pmwd_tasks_recurrence_series_idx
    ON pmwd_tasks(user_id, recurrence_series_id, recurrence_occurrence_date);

    CREATE UNIQUE INDEX IF NOT EXISTS pmwd_assistant_threads_active_entity_unique
    ON pmwd_assistant_threads(user_id, surface, entity_type, entity_client_id)
    WHERE status = 'active'
      AND entity_type IS NOT NULL
      AND entity_client_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS pmwd_assistant_threads_user_surface_idx
    ON pmwd_assistant_threads(user_id, surface, status);

    CREATE INDEX IF NOT EXISTS pmwd_assistant_messages_thread_id_idx
    ON pmwd_assistant_messages(thread_id, id);
  `);
}

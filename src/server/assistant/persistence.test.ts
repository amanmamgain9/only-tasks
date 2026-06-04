import Database from "better-sqlite3";
import { describe, expect, test } from "vitest";
import { initializeDatabase } from "../db/init";

describe("assistant persistence schema", () => {
  test("stores a thread with user and assistant messages plus structured output", () => {
    const sqlite = new Database(":memory:");
    initializeDatabase(sqlite);
    const now = "2026-06-03T10:00:00.000Z";
    const userId = Number(sqlite
      .prepare(
        `INSERT INTO users (email, auth_provider, created_at, updated_at)
         VALUES ('assistant-test@example.com', 'test', @now, @now)`,
      )
      .run({ now }).lastInsertRowid);

    const threadId = Number(sqlite
      .prepare(
        `INSERT INTO pmwd_assistant_threads
         (user_id, surface, entity_type, entity_client_id, status, title, created_at, updated_at)
         VALUES (@userId, 'task_recurrence', 'task', 'task-1', 'active', 'Repeat', @now, @now)`,
      )
      .run({ userId, now }).lastInsertRowid);

    sqlite
      .prepare(
        `INSERT INTO pmwd_assistant_messages
         (thread_id, user_id, role, content, structured_payload, created_at)
         VALUES (@threadId, @userId, 'user', 'every weekday', NULL, @now)`,
      )
      .run({ threadId, userId, now });

    sqlite
      .prepare(
        `INSERT INTO pmwd_assistant_messages
         (thread_id, user_id, role, content, structured_payload, created_at)
         VALUES (@threadId, @userId, 'assistant', 'Every weekday starting Jun 3, 2026', @payload, @now)`,
      )
      .run({
        threadId,
        userId,
        now,
        payload: JSON.stringify({ type: "recurrence_assistant_result", ok: true }),
      });

    const messages = sqlite
      .prepare(
        `SELECT role, content, structured_payload AS structuredPayload
         FROM pmwd_assistant_messages
         WHERE thread_id = ?
         ORDER BY id ASC`,
      )
      .all(threadId) as Array<{ role: string; content: string; structuredPayload: string | null }>;

    expect(messages).toEqual([
      { role: "user", content: "every weekday", structuredPayload: null },
      {
        role: "assistant",
        content: "Every weekday starting Jun 3, 2026",
        structuredPayload: JSON.stringify({ type: "recurrence_assistant_result", ok: true }),
      },
    ]);
  });
});

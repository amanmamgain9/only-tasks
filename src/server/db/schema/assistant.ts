import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const assistantThreadStatuses = ["active", "archived"] as const;
export const assistantMessageRoles = ["assistant", "user", "system"] as const;

export const assistantThreads = sqliteTable("pmwd_assistant_threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  surface: text("surface").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  entityClientId: text("entity_client_id"),
  status: text("status", { enum: assistantThreadStatuses }).notNull().default("active"),
  title: text("title"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const assistantMessages = sqliteTable("pmwd_assistant_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id")
    .notNull()
    .references(() => assistantThreads.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: assistantMessageRoles }).notNull(),
  content: text("content").notNull(),
  structuredPayload: text("structured_payload"),
  createdAt: text("created_at").notNull(),
});

export type AssistantThread = InferSelectModel<typeof assistantThreads>;
export type InsertAssistantThread = InferInsertModel<typeof assistantThreads>;
export type AssistantMessage = InferSelectModel<typeof assistantMessages>;
export type InsertAssistantMessage = InferInsertModel<typeof assistantMessages>;

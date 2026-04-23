import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const projects = sqliteTable("pmwd_projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type", { enum: ["main", "side_project", "chore"] }).notNull().default("main"),
  status: text("status", { enum: ["active", "completed", "on_hold", "cancelled", "archived"] })
    .notNull()
    .default("active"),
  targetDate: text("target_date"),
  draft: integer("draft").notNull().default(0),
  createdByChatId: integer("created_by_chat_id"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Project = InferSelectModel<typeof projects>;
export type InsertProject = InferInsertModel<typeof projects>;

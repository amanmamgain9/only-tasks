import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { tasks } from "./tasks";
import { users } from "./users";

export const recurrenceStatuses = ["active", "inactive"] as const;

export const taskRecurrenceSeries = sqliteTable("pmwd_task_recurrence_series", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  templateTaskId: integer("template_task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  status: text("status", { enum: recurrenceStatuses }).notNull().default("active"),
  rule: text("rule").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type TaskRecurrenceSeries = InferSelectModel<typeof taskRecurrenceSeries>;
export type InsertTaskRecurrenceSeries = InferInsertModel<typeof taskRecurrenceSeries>;

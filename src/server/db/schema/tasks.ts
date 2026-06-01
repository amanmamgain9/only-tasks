import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { AnySQLiteColumn, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { projects } from "./projects";
import { users } from "./users";

export const tasks = sqliteTable("pmwd_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  parentTaskId: integer("parent_task_id").references((): AnySQLiteColumn => tasks.id, {
    onDelete: "cascade",
  }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  path: text("path").notNull().default("/"),
  dueDate: text("due_date"),
  originalDueDate: text("original_due_date"),
  rolloverHistory: text("rollover_history"),
  isCompleted: integer("is_completed").notNull().default(0),
  priority: integer("priority"),
  estimatedTimeMinutes: integer("estimated_time_minutes"),
  completedAt: text("completed_at"),
  categoryAllocations: text("category_allocations"),
  lifestyleTraits: text("lifestyle_traits"),
  systemType: text("system_type"),
  recurrenceSeriesId: integer("recurrence_series_id"),
  recurrenceRole: text("recurrence_role"),
  recurrenceTemplateTaskId: integer("recurrence_template_task_id"),
  recurrenceOccurrenceDate: text("recurrence_occurrence_date"),
  recurrenceStatus: text("recurrence_status"),
  recurrenceIsOverride: integer("recurrence_is_override").notNull().default(0),
  clientId: text("client_id"),
  position: text("position").notNull().default("a0"),
  deleted: integer("deleted").notNull().default(0),
  archived: integer("archived").notNull().default(0),
  draft: integer("draft").notNull().default(0),
  chatId: integer("draft_chat_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Task = InferSelectModel<typeof tasks>;
export type InsertTask = InferInsertModel<typeof tasks>;

const prioritySchema = z.number().int().min(1).max(5).nullable().optional();

export const createTaskSchema = z.object({
  userId: z.number().int().positive(),
  title: z.string(),
  description: z.string().nullable().optional(),
  parentTaskId: z.number().int().positive().nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  path: z.string().min(1),
  dueDate: z.string().nullable().optional(),
  originalDueDate: z.string().nullable().optional(),
  rolloverHistory: z.string().nullable().optional(),
  isCompleted: z.number().int().min(0).max(1).default(0),
  priority: prioritySchema,
  estimatedTimeMinutes: z.number().int().positive().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  categoryAllocations: z.string().nullable().optional(),
  lifestyleTraits: z.string().nullable().optional(),
  systemType: z.string().nullable().optional(),
  recurrenceSeriesId: z.number().int().positive().nullable().optional(),
  recurrenceRole: z.enum(["template", "occurrence_root", "occurrence_child"]).nullable().optional(),
  recurrenceTemplateTaskId: z.number().int().positive().nullable().optional(),
  recurrenceOccurrenceDate: z.string().nullable().optional(),
  recurrenceStatus: z.enum(["scheduled", "skipped"]).nullable().optional(),
  recurrenceIsOverride: z.number().int().min(0).max(1).optional(),
  position: z.string().default("a0"),
  deleted: z.number().int().min(0).max(1).default(0),
  archived: z.number().int().min(0).max(1).default(0),
  draft: z.number().int().min(0).max(1).default(0),
  chatId: z.number().int().positive().nullable().optional(),
  clientId: z.string(),
});

export const updateTaskSchema = createTaskSchema.partial().omit({ userId: true });

export const findTasksByUserIdOptionsSchema = z.object({
  includeCompleted: z.boolean().optional(),
  includeDeleted: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
  projectId: z.number().int().positive().optional(),
  parentTaskId: z.number().int().positive().nullable().optional(),
  dueDateStart: z.string().optional(),
  dueDateEnd: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  isBacklog: z.boolean().optional(),
  pathStartsWith: z.string().optional(),
  chatId: z.number().int().positive().optional(),
  draft: z.number().int().min(0).max(1).optional(),
  excludeRecurrenceOccurrences: z.boolean().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type FindTasksByUserIdOptions = z.infer<typeof findTasksByUserIdOptionsSchema>;

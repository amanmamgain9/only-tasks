import { z } from "zod";

const taskCategoryAllocationSchema = z.object({
  category: z.enum(["job", "side_project", "learning", "health", "social", "chore", "hobby"]),
  weight: z.number().int().min(1).max(100),
});

const subtreeNodeSchema: z.ZodSchema<{
  clientId: string;
  title: string;
  position: string;
  isCompleted: boolean;
  estimatedTimeMinutes?: number | null;
  dueDate?: string | null;
  priority?: number | null;
  description?: string | null;
  categoryAllocations?: Array<{ category: "job" | "side_project" | "learning" | "health" | "social" | "chore" | "hobby"; weight: number }>;
  subtasks?: any[];
}> = z.lazy(() =>
  z.object({
    clientId: z.string(),
    title: z.string(),
    position: z.string(),
    isCompleted: z.boolean(),
    estimatedTimeMinutes: z.number().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    priority: z.number().nullable().optional(),
    description: z.string().nullable().optional(),
    categoryAllocations: z.array(taskCategoryAllocationSchema).optional(),
    subtasks: z.array(subtreeNodeSchema).optional(),
  }),
);

const operationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("UPDATE_TITLE"),
    clientId: z.string(),
    title: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("TOGGLE_COMPLETE"),
    clientId: z.string(),
    isCompleted: z.boolean(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("UPDATE_METADATA"),
    clientId: z.string(),
    estimatedTimeMinutes: z.number().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    priority: z.number().nullable().optional(),
    description: z.string().nullable().optional(),
    categoryAllocations: z.array(taskCategoryAllocationSchema).optional(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("DELETE_TASK"),
    clientId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("CREATE_TASK"),
    clientId: z.string(),
    parentClientId: z.string().nullable(),
    position: z.string(),
    metadata: z
      .object({
        dueDate: z.string().nullable().optional(),
        estimatedTimeMinutes: z.number().nullable().optional(),
        priority: z.number().nullable().optional(),
        categoryAllocations: z.array(taskCategoryAllocationSchema).optional(),
      })
      .optional(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("IMPORT_TASKS"),
    rootClientId: z.string(),
    parentClientId: z.string().nullable(),
    subtree: subtreeNodeSchema,
    timestamp: z.number(),
  }),
]);

export const operationBatchSchema = z.object({
  batchId: z.string(),
  projectId: z.number(),
  timestamp: z.number(),
  operations: z.array(operationSchema),
  chatId: z.number().positive().optional(),
});

export type Operation = z.infer<typeof operationSchema>;
export type OperationBatch = z.infer<typeof operationBatchSchema>;
export type SubtreeNode = z.infer<typeof subtreeNodeSchema>;

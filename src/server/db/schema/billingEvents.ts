import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const billingEvents = sqliteTable("billing_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull().default("paddle"),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  processingStatus: text("processing_status").notNull().default("received"),
  rawBody: text("raw_body"),
  errorMessage: text("error_message"),
  occurredAt: text("occurred_at"),
  processedAt: text("processed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type BillingEvent = InferSelectModel<typeof billingEvents>;
export type InsertBillingEvent = InferInsertModel<typeof billingEvents>;

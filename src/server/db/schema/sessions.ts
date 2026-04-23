import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const authSessions = sqliteTable("auth_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastSeenAt: text("last_seen_at"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});

export type AuthSession = InferSelectModel<typeof authSessions>;
export type InsertAuthSession = InferInsertModel<typeof authSessions>;

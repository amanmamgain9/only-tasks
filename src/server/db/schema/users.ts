import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  name: text("name"),
  image: text("image"),
  googleId: text("google_id"),
  profilePicture: text("profile_picture"),
  authProvider: text("auth_provider").notNull().default("google"),
  lastLoginAt: text("last_login_at"),
  isAdmin: integer("is_admin").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type User = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;

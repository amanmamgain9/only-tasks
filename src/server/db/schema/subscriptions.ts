import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  provider: text("provider").notNull().default("manual"),
  planKey: text("plan_key"),
  legacyPlanId: integer("legacy_plan_id"),
  currentPeriodStartsAt: text("current_period_starts_at"),
  currentPeriodEndsAt: text("current_period_ends_at"),
  nextBilledAt: text("next_billed_at"),
  canceledAt: text("canceled_at"),
  autoRenew: integer("auto_renew").notNull().default(1),
  paddleCustomerId: text("paddle_customer_id"),
  paddleSubscriptionId: text("paddle_subscription_id"),
  paddlePriceId: text("paddle_price_id"),
  paddleUpdatedAt: text("paddle_updated_at"),
  legacyPaypalSubscriptionId: text("legacy_paypal_subscription_id"),
  legacyLemonSqueezySubscriptionId: text("legacy_lemonsqueezy_subscription_id"),
  requiresBillingMigrationReview: integer("requires_billing_migration_review").notNull().default(0),
  source: text("source").notNull().default("native"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Subscription = InferSelectModel<typeof subscriptions>;
export type InsertSubscription = InferInsertModel<typeof subscriptions>;

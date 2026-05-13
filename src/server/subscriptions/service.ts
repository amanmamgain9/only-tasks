import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  cancelPaddleSubscription,
  pausePaddleSubscription,
  removePaddleSubscriptionScheduledChange,
  resumePaddleSubscription,
} from "../billing/paddle";
import { billingEvents } from "../db/schema/billingEvents";
import { subscriptions, type Subscription } from "../db/schema/subscriptions";
import type { PaddleSubscriptionSnapshot } from "../billing/paddleWebhook";

export type SubscriptionSummary = {
  id: number;
  status: string;
  provider: string;
  planKey: string | null;
  label: string;
  note: string | null;
  isEntitled: boolean;
  isTrial: boolean;
  requiresBillingMigrationReview: boolean;
  autoRenew: boolean;
  billingPortalAvailable: boolean;
};

function normalizeStatus(status: string | null | undefined) {
  if (typeof status !== "string") return null;
  const normalized = status.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function parseDateMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getEffectivePeriodEnd(subscription: Pick<Subscription, "currentPeriodEndsAt" | "nextBilledAt">) {
  return parseDateMs(subscription.currentPeriodEndsAt) ?? parseDateMs(subscription.nextBilledAt);
}

export function isSubscriptionEntitled(
  subscription: Pick<Subscription, "status" | "currentPeriodEndsAt" | "nextBilledAt">,
  now = Date.now(),
) {
  const status = normalizeStatus(subscription.status);
  const effectiveEnd = getEffectivePeriodEnd(subscription);

  if (status === "active" || status === "trial" || status === "trialing") {
    return effectiveEnd === null ? true : now < effectiveEnd;
  }

  if (status === "canceled") {
    return effectiveEnd !== null && now < effectiveEnd;
  }

  return false;
}

function getEntitlementRank(subscription: Subscription, now: number) {
  if (subscription.planKey === "lifetime" && isSubscriptionEntitled(subscription, now)) return 4;
  if (isSubscriptionEntitled(subscription, now)) return 3;

  switch (normalizeStatus(subscription.status)) {
    case "pending":
      if (subscription.requiresBillingMigrationReview === 1) return 0;
      return 2;
    case "past_due":
    case "paused":
      return 1;
    default:
      return 0;
  }
}

export function pickEffectiveSubscription(rows: Subscription[], now = Date.now()) {
  const sorted = [...rows].sort((left, right) => {
    const entitlementDiff = getEntitlementRank(right, now) - getEntitlementRank(left, now);
    if (entitlementDiff !== 0) return entitlementDiff;

    const rightPeriodEnd = getEffectivePeriodEnd(right) ?? 0;
    const leftPeriodEnd = getEffectivePeriodEnd(left) ?? 0;
    if (rightPeriodEnd !== leftPeriodEnd) return rightPeriodEnd - leftPeriodEnd;

    const rightUpdated = parseDateMs(right.updatedAt) ?? parseDateMs(right.createdAt) ?? 0;
    const leftUpdated = parseDateMs(left.updatedAt) ?? parseDateMs(left.createdAt) ?? 0;
    return rightUpdated - leftUpdated;
  });
  const best = sorted[0] ?? null;
  if (!best || getEntitlementRank(best, now) === 0) return null;
  return best;
}

function getPlanLabel(planKey: string | null | undefined) {
  switch (planKey) {
    case "lifetime":
      return "Lifetime";
    case "pro_monthly":
      return "Pro";
    case "trial":
      return "Trial";
    default:
      return "Free";
  }
}

function buildSubscriptionNote(subscription: Subscription, now: number) {
  if (subscription.requiresBillingMigrationReview) {
    return "Legacy billing exists. Move this user to Paddle before self-serve billing management.";
  }

  const effectiveEnd = getEffectivePeriodEnd(subscription);
  if (normalizeStatus(subscription.status) === "trial" || normalizeStatus(subscription.status) === "trialing") {
    if (effectiveEnd === null) return "Trial access is active.";
    return `Trial access until ${new Date(effectiveEnd).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}.`;
  }

  if (normalizeStatus(subscription.status) === "active") {
    if (subscription.planKey === "lifetime") return "Lifetime access is active.";
    if (effectiveEnd === null) return "Subscription access is active.";
    return `Renews on ${new Date(effectiveEnd).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}.`;
  }

  if (normalizeStatus(subscription.status) === "canceled" && effectiveEnd !== null && now < effectiveEnd) {
    return `Access ends on ${new Date(effectiveEnd).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}.`;
  }

  if (normalizeStatus(subscription.status) === "pending") {
    return "Billing has been initiated but is not active yet.";
  }

  return null;
}

export function summarizeSubscription(subscription: Subscription | null, now = Date.now()): SubscriptionSummary | null {
  if (!subscription) return null;

  const status = normalizeStatus(subscription.status) ?? "inactive";
  const isTrial = status === "trial" || status === "trialing";

  return {
    id: subscription.id,
    status,
    provider: subscription.provider,
    planKey: subscription.planKey ?? null,
    label: getPlanLabel(subscription.planKey),
    note: buildSubscriptionNote(subscription, now),
    isEntitled: isSubscriptionEntitled(subscription, now),
    isTrial,
    requiresBillingMigrationReview: subscription.requiresBillingMigrationReview === 1,
    autoRenew: subscription.autoRenew === 1,
    billingPortalAvailable: Boolean(subscription.paddleCustomerId && subscription.paddleSubscriptionId),
  };
}

export async function listSubscriptionsForUser(userId: number) {
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.updatedAt), desc(subscriptions.createdAt));
}

export async function getEffectiveSubscriptionForUser(userId: number) {
  const rows = await listSubscriptionsForUser(userId);
  const summary = summarizeSubscription(pickEffectiveSubscription(rows));
  if (!summary) return null;

  return {
    ...summary,
    billingPortalAvailable:
      summary.billingPortalAvailable ||
      rows.some((row) => Boolean(row.paddleCustomerId && row.paddleSubscriptionId)),
  };
}

export async function getPaddleBillingContextForUser(userId: number) {
  const rows = await listSubscriptionsForUser(userId);
  const paddleCustomerId =
    rows.find((row) => row.paddleCustomerId && row.provider === "paddle")?.paddleCustomerId ??
    rows.find((row) => row.paddleCustomerId)?.paddleCustomerId ??
    null;
  const subscriptionIds = Array.from(
    new Set(
      rows
        .map((row) => row.paddleSubscriptionId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return {
    paddleCustomerId,
    subscriptionIds,
  };
}

export function hasConsumedTrial(rows: Subscription[]) {
  return rows.some((row) => {
    if (row.planKey === "lifetime") return true;
    if (row.provider === "trial" || row.planKey === "trial") return true;
    if (row.provider === "paddle" && row.planKey === "pro_monthly") return true;
    return normalizeStatus(row.status) === "trial" || normalizeStatus(row.status) === "trialing";
  });
}

function subscriptionCanBeAutoCanceledAfterLifetime(subscription: Subscription) {
  if (subscription.provider !== "paddle" || subscription.planKey !== "pro_monthly") return false;
  if (!subscription.paddleSubscriptionId) return false;
  const status = normalizeStatus(subscription.status);
  if (status === "paused") return true;
  if (subscription.autoRenew !== 1) return false;
  return status === "active" || status === "trialing" || status === "trial" || status === "paused";
}

async function scheduleMonthlyCancellationAfterLifetime(rows: Subscription[]) {
  const candidates = rows.filter(subscriptionCanBeAutoCanceledAfterLifetime);
  const canceledSubscriptionIds: string[] = [];
  const failedSubscriptionIds: string[] = [];

  for (const subscription of candidates) {
    const subscriptionId = subscription.paddleSubscriptionId;
    if (!subscriptionId) continue;

    try {
      if (normalizeStatus(subscription.status) === "trialing") {
        await pausePaddleSubscription(subscriptionId);
      } else if (normalizeStatus(subscription.status) === "paused") {
        await cancelPaddleSubscription(subscriptionId, "immediately");
      } else {
        await cancelPaddleSubscription(subscriptionId, "next_billing_period");
      }
      canceledSubscriptionIds.push(subscriptionId);
      await db
        .update(subscriptions)
        .set({
          autoRenew: 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(subscriptions.id, subscription.id));
    } catch (error) {
      failedSubscriptionIds.push(subscriptionId);
      console.error("Failed to schedule Paddle monthly cancellation after lifetime purchase", {
        subscriptionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    canceledSubscriptionIds,
    failedSubscriptionIds,
  };
}

async function scheduleLifetimeNonRenewalAfterActivation(subscription: Subscription) {
  if (subscription.provider !== "paddle" || subscription.planKey !== "lifetime") {
    return { lifetimeNonRenewalScheduled: false as const };
  }
  if (!subscription.paddleSubscriptionId || subscription.autoRenew !== 1) {
    return { lifetimeNonRenewalScheduled: false as const };
  }
  if (normalizeStatus(subscription.status) !== "active") {
    return { lifetimeNonRenewalScheduled: false as const };
  }

  try {
    await cancelPaddleSubscription(subscription.paddleSubscriptionId, "next_billing_period");
    await db
      .update(subscriptions)
      .set({
        autoRenew: 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(subscriptions.id, subscription.id));

    return { lifetimeNonRenewalScheduled: true as const };
  } catch (error) {
    console.error("Failed to schedule Paddle lifetime non-renewal", {
      subscriptionId: subscription.paddleSubscriptionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      lifetimeNonRenewalScheduled: false as const,
      lifetimeNonRenewalFailed: true as const,
    };
  }
}

export async function continuePaddleMonthlyForUser(userId: number) {
  const rows = await listSubscriptionsForUser(userId);
  const row = rows.find((subscription) => {
    if (subscription.provider !== "paddle" || subscription.planKey !== "pro_monthly") return false;
    if (!subscription.paddleSubscriptionId) return false;
    const status = normalizeStatus(subscription.status);
    return status === "trialing" || status === "active" || status === "paused";
  });

  if (!row?.paddleSubscriptionId) {
    return { handled: false as const };
  }

  const status = normalizeStatus(row.status);
  const now = new Date().toISOString();

  if (status === "paused") {
    await resumePaddleSubscription(row.paddleSubscriptionId);
    await db
      .update(subscriptions)
      .set({
        status: "active",
        autoRenew: 1,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, row.id));

    return {
      handled: true as const,
      action: "resumed_monthly",
      message: "Monthly billing resumed.",
    };
  }

  if (row.autoRenew === 0) {
    await removePaddleSubscriptionScheduledChange(row.paddleSubscriptionId);
    await db
      .update(subscriptions)
      .set({
        autoRenew: 1,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, row.id));

    return {
      handled: true as const,
      action: "monthly_continues",
      message: status === "trialing" ? "Monthly billing will continue after the trial." : "Monthly billing will continue.",
    };
  }

  return {
    handled: true as const,
    action: "monthly_already_active",
    message: status === "trialing" ? "Your monthly trial is already set to continue." : "Monthly billing is already active.",
  };
}

export async function beginBillingEvent(event: {
  eventId: string;
  eventType: string;
  occurredAt?: string | null;
  rawBody?: string | null;
}) {
  const now = new Date().toISOString();

  try {
    await db.insert(billingEvents).values({
      provider: "paddle",
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt ?? null,
      rawBody: event.rawBody ?? null,
      processingStatus: "received",
      createdAt: now,
      updatedAt: now,
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("unique")) {
      const existing = await db
        .select()
        .from(billingEvents)
        .where(eq(billingEvents.eventId, event.eventId))
        .limit(1);
      if (existing[0]?.processingStatus === "failed") {
        await db
          .update(billingEvents)
          .set({
            processingStatus: "received",
            errorMessage: null,
            updatedAt: now,
          })
          .where(eq(billingEvents.eventId, event.eventId));
        return true;
      }
      return false;
    }
    throw error;
  }
}

export async function finishBillingEvent(eventId: string, processingStatus: "processed" | "ignored" | "failed", errorMessage?: string | null) {
  const now = new Date().toISOString();
  await db
    .update(billingEvents)
    .set({
      processingStatus,
      errorMessage: errorMessage ?? null,
      processedAt: now,
      updatedAt: now,
    })
    .where(eq(billingEvents.eventId, eventId));
}

async function getSubscriptionByPaddleSubscriptionId(subscriptionId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.paddleSubscriptionId, subscriptionId))
    .limit(1);
  return rows[0] ?? null;
}

async function getSubscriptionsByPaddleCustomerId(customerId: string) {
  return db.select().from(subscriptions).where(eq(subscriptions.paddleCustomerId, customerId));
}

async function resolveUserIdFromPaddleSnapshot(snapshot: {
  userId: number | null;
  subscriptionId?: string | null;
  customerId?: string | null;
}) {
  if (snapshot.userId) return snapshot.userId;

  if (snapshot.subscriptionId) {
    const existing = await getSubscriptionByPaddleSubscriptionId(snapshot.subscriptionId);
    if (existing) return existing.userId;
  }

  if (snapshot.customerId) {
    const rows = await getSubscriptionsByPaddleCustomerId(snapshot.customerId);
    if (rows[0]) return rows[0].userId;
  }

  return null;
}

function isIncomingSubscriptionStale(existing: Subscription, snapshot: Pick<PaddleSubscriptionSnapshot, "updatedAt" | "occurredAt">) {
  const incoming = Date.parse(snapshot.updatedAt ?? snapshot.occurredAt ?? "");
  const stored = Date.parse(existing.paddleUpdatedAt ?? "");
  return Number.isFinite(incoming) && Number.isFinite(stored) && incoming < stored;
}

export async function upsertPaddleSubscription(snapshot: PaddleSubscriptionSnapshot) {
  if (!snapshot.subscriptionId) {
    return { processed: false, reason: "missing_subscription_id" };
  }

  const existing = await getSubscriptionByPaddleSubscriptionId(snapshot.subscriptionId);
  if (existing && isIncomingSubscriptionStale(existing, snapshot)) {
    return { processed: false, reason: "stale_subscription_event" };
  }

  const userId = await resolveUserIdFromPaddleSnapshot(snapshot);
  if (!userId) {
    throw new Error("Could not resolve user for Paddle subscription webhook");
  }

  const now = new Date().toISOString();
  const status = snapshot.status || "active";
  const planKey = snapshot.planKey ?? existing?.planKey;
  if (!planKey) {
    return { processed: false, reason: "unknown_subscription_plan" };
  }
  const values = {
    userId,
    status,
    provider: "paddle",
    planKey,
    currentPeriodStartsAt: snapshot.currentPeriodStartsAt,
    currentPeriodEndsAt: snapshot.currentPeriodEndsAt,
    nextBilledAt: snapshot.nextBilledAt,
    canceledAt: snapshot.canceledAt,
    autoRenew: snapshot.canceledAt || snapshot.scheduledChangeAction === "cancel" || snapshot.scheduledChangeAction === "pause" ? 0 : 1,
    paddleCustomerId: snapshot.customerId,
    paddleSubscriptionId: snapshot.subscriptionId,
    paddlePriceId: snapshot.priceId,
    paddleUpdatedAt: snapshot.updatedAt ?? snapshot.occurredAt,
    requiresBillingMigrationReview: 0,
    source: "paddle_webhook",
    updatedAt: now,
  };

  if (existing) {
    await db.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id));
    const updated = {
      ...existing,
      ...values,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    const cancellation =
      planKey === "lifetime" ? await scheduleMonthlyCancellationAfterLifetime(await listSubscriptionsForUser(userId)) : {};
    const lifetimeNonRenewal = await scheduleLifetimeNonRenewalAfterActivation(updated);
    return { processed: true, id: existing.id, ...cancellation, ...lifetimeNonRenewal };
  }

  const [created] = await db
    .insert(subscriptions)
    .values({
      ...values,
      createdAt: now,
    })
    .returning();

  const cancellation =
    planKey === "lifetime" ? await scheduleMonthlyCancellationAfterLifetime(await listSubscriptionsForUser(userId)) : {};
  const lifetimeNonRenewal = await scheduleLifetimeNonRenewalAfterActivation(created);
  return { processed: true, id: created.id, ...cancellation, ...lifetimeNonRenewal };
}

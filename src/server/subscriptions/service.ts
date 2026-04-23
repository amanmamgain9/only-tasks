import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { subscriptions, type Subscription } from "../db/schema/subscriptions";

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
  if (isSubscriptionEntitled(subscription, now)) return 3;

  switch (normalizeStatus(subscription.status)) {
    case "pending":
      return 2;
    case "past_due":
    case "paused":
      return 1;
    default:
      return 0;
  }
}

export function pickEffectiveSubscription(rows: Subscription[], now = Date.now()) {
  return [...rows].sort((left, right) => {
    const entitlementDiff = getEntitlementRank(right, now) - getEntitlementRank(left, now);
    if (entitlementDiff !== 0) return entitlementDiff;

    const rightPeriodEnd = getEffectivePeriodEnd(right) ?? 0;
    const leftPeriodEnd = getEffectivePeriodEnd(left) ?? 0;
    if (rightPeriodEnd !== leftPeriodEnd) return rightPeriodEnd - leftPeriodEnd;

    const rightUpdated = parseDateMs(right.updatedAt) ?? parseDateMs(right.createdAt) ?? 0;
    const leftUpdated = parseDateMs(left.updatedAt) ?? parseDateMs(left.createdAt) ?? 0;
    return rightUpdated - leftUpdated;
  })[0] ?? null;
}

function getPlanLabel(planKey: string | null | undefined) {
  switch (planKey) {
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
  return summarizeSubscription(pickEffectiveSubscription(rows));
}

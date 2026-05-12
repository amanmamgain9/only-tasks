import { getPaddlePlanKeyForPrice, parsePaddlePlanKey, type PaddlePlanKey } from "./plans";

export type PaddleWebhookEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string | null;
  data: Record<string, unknown>;
};

export type PaddleSubscriptionSnapshot = {
  eventId: string;
  eventType: string;
  occurredAt: string | null;
  userId: number | null;
  planKey: PaddlePlanKey | null;
  subscriptionId: string | null;
  customerId: string | null;
  status: string | null;
  priceId: string | null;
  currentPeriodStartsAt: string | null;
  currentPeriodEndsAt: string | null;
  nextBilledAt: string | null;
  canceledAt: string | null;
  updatedAt: string | null;
};

export type PaddleLifetimePurchaseSnapshot = {
  eventId: string;
  eventType: string;
  occurredAt: string | null;
  userId: number | null;
  transactionId: string;
  customerId: string | null;
  status: string | null;
  priceId: string | null;
  updatedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getValue(record: Record<string, unknown> | null, ...keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
}

function getString(record: Record<string, unknown> | null, ...keys: string[]) {
  const value = getValue(record, ...keys);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNumberFromCustomData(record: Record<string, unknown> | null, ...keys: string[]) {
  const value = getValue(record, ...keys);
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number.parseInt(value, 10);
  return null;
}

function normalizeStatus(value: string | null) {
  return value ? value.trim().toLowerCase() : null;
}

function extractItems(data: Record<string, unknown>) {
  const rawItems = getValue(data, "items");
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function extractPriceId(data: Record<string, unknown>) {
  for (const item of extractItems(data)) {
    const price = asRecord(getValue(item, "price"));
    const priceId = getString(price, "id");
    if (priceId) return priceId;
  }
  return null;
}

function extractCustomData(data: Record<string, unknown>) {
  return asRecord(getValue(data, "custom_data", "customData"));
}

export function parsePaddleWebhookEvent(rawBody: string): PaddleWebhookEvent {
  const parsed = JSON.parse(rawBody) as unknown;
  const root = asRecord(parsed);
  const data = asRecord(getValue(root, "data"));
  const eventId = getString(root, "event_id", "eventId");
  const eventType = getString(root, "event_type", "eventType");

  if (!root || !data || !eventId || !eventType) {
    throw new Error("Invalid Paddle webhook payload");
  }

  return {
    eventId,
    eventType,
    occurredAt: getString(root, "occurred_at", "occurredAt"),
    data,
  };
}

export function extractPaddleSubscriptionSnapshot(event: PaddleWebhookEvent): PaddleSubscriptionSnapshot | null {
  if (!event.eventType.startsWith("subscription.")) return null;

  const data = event.data;
  const customData = extractCustomData(data);
  const currentPeriod = asRecord(getValue(data, "current_billing_period", "currentBillingPeriod"));
  const priceId = extractPriceId(data);
  const customPlanKey = parsePaddlePlanKey(getString(customData, "planKey", "plan"));

  return {
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    userId: getNumberFromCustomData(customData, "userId", "user_id"),
    planKey: getPaddlePlanKeyForPrice(priceId) ?? customPlanKey,
    subscriptionId: getString(data, "id", "subscription_id", "subscriptionId"),
    customerId: getString(data, "customer_id", "customerId"),
    status: normalizeStatus(getString(data, "status")),
    priceId,
    currentPeriodStartsAt: getString(currentPeriod, "starts_at", "startsAt"),
    currentPeriodEndsAt: getString(currentPeriod, "ends_at", "endsAt"),
    nextBilledAt: getString(data, "next_billed_at", "nextBilledAt"),
    canceledAt: getString(data, "canceled_at", "canceledAt"),
    updatedAt: getString(data, "updated_at", "updatedAt"),
  };
}

export function extractPaddleLifetimePurchaseSnapshot(event: PaddleWebhookEvent): PaddleLifetimePurchaseSnapshot | null {
  if (event.eventType !== "transaction.completed") return null;

  const data = event.data;
  const priceId = extractPriceId(data);
  const planKey = getPaddlePlanKeyForPrice(priceId);
  const customData = extractCustomData(data);
  const customPlan = getString(customData, "planKey", "plan");
  const transactionId = getString(data, "id");

  if (!transactionId || (planKey !== "lifetime" && customPlan !== "lifetime")) {
    return null;
  }

  return {
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    userId: getNumberFromCustomData(customData, "userId", "user_id"),
    transactionId,
    customerId: getString(data, "customer_id", "customerId"),
    status: normalizeStatus(getString(data, "status")),
    priceId,
    updatedAt: getString(data, "updated_at", "updatedAt"),
  };
}

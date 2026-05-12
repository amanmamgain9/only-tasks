import { createHmac, timingSafeEqual } from "node:crypto";

export type PaddleEnvironment = "sandbox" | "production";

function normalizePaddleEnvironment(value: string | undefined): PaddleEnvironment {
  if (!value || value === "sandbox") return "sandbox";
  if (value === "production") return "production";
  throw new Error("Invalid Paddle environment. Use 'sandbox' or 'production'.");
}

export function getPaddleEnvironment(): PaddleEnvironment {
  return normalizePaddleEnvironment(process.env.PADDLE_ENVIRONMENT ?? process.env.PADDLE_ENV);
}

export function getPublicPaddleEnvironment(): PaddleEnvironment {
  return normalizePaddleEnvironment(process.env.NEXT_PUBLIC_PADDLE_ENV ?? process.env.PADDLE_ENVIRONMENT ?? process.env.PADDLE_ENV);
}

export function getPaddleClientToken() {
  return process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";
}

export function getPaddleApiKey() {
  return process.env.PADDLE_API_KEY || "";
}

export function getPaddleWebhookSecret() {
  return process.env.PADDLE_WEBHOOK_SECRET || "";
}

export function getPaddleApiBaseUrl() {
  return getPaddleEnvironment() === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

export function isPaddleCheckoutConfigured() {
  return Boolean(getPaddleClientToken());
}

export function isPaddlePortalConfigured() {
  return Boolean(getPaddleApiKey());
}

function safeCompareHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyPaddleWebhookSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const timestamp = parts.find((part) => part.startsWith("ts="))?.slice(3);
  const signatures = parts
    .filter((part) => part.startsWith("h1="))
    .map((part) => part.slice(3))
    .filter(Boolean);

  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) {
    return false;
  }

  const eventTimeMs = Number.parseInt(timestamp, 10) * 1000;
  if (!Number.isFinite(eventTimeMs) || Math.abs(Date.now() - eventTimeMs) > 5 * 60_000) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}:${rawBody}`).digest("hex");
  return signatures.some((signature) => /^[a-f0-9]+$/i.test(signature) && safeCompareHex(signature, expected));
}

async function paddleApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = getPaddleApiKey();
  if (!apiKey) {
    throw new Error("Missing PADDLE_API_KEY");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${getPaddleApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Paddle API failed with ${response.status}: ${body.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

type CustomerPortalSessionResponse = {
  data?: {
    urls?: {
      general?: {
        overview?: string;
      };
    };
  };
};

export async function createPaddleCustomerPortalSession(customerId: string, subscriptionIds: string[]) {
  const payload = await paddleApi<CustomerPortalSessionResponse>(
    `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    {
      method: "POST",
      body: JSON.stringify({
        subscription_ids: subscriptionIds,
      }),
    },
  );
  const url = payload.data?.urls?.general?.overview;
  if (!url) {
    throw new Error("Paddle portal session did not return an overview URL");
  }
  return url;
}

export async function cancelPaddleSubscription(
  subscriptionId: string,
  effectiveFrom: "next_billing_period" | "immediately" = "next_billing_period",
) {
  await paddleApi<{ data?: unknown }>(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({
      effective_from: effectiveFrom,
    }),
  });
}

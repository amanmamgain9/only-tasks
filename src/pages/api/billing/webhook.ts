import type { NextApiRequest, NextApiResponse } from "next";
import { getPaddleWebhookSecret, verifyPaddleWebhookSignature } from "@/server/billing/paddle";
import {
  extractPaddleLifetimePurchaseSnapshot,
  extractPaddleSubscriptionSnapshot,
  parsePaddleWebhookEvent,
} from "@/server/billing/paddleWebhook";
import {
  beginBillingEvent,
  finishBillingEvent,
  recordPaddleLifetimePurchase,
  upsertPaddleSubscription,
} from "@/server/subscriptions/service";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const signature = getHeaderValue(req.headers["paddle-signature"]);
  if (!signature) {
    res.status(400).json({ success: false, error: "Missing paddle-signature header" });
    return;
  }

  const secret = getPaddleWebhookSecret();
  if (!secret) {
    res.status(500).json({ success: false, error: "Missing PADDLE_WEBHOOK_SECRET" });
    return;
  }

  const rawBody = await readRawBody(req);
  if (!verifyPaddleWebhookSignature(rawBody, signature, secret)) {
    res.status(400).json({ success: false, error: "Invalid Paddle webhook signature" });
    return;
  }

  let event;
  try {
    event = parsePaddleWebhookEvent(rawBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Paddle webhook payload";
    res.status(400).json({ success: false, error: message });
    return;
  }

  const shouldProcess = await beginBillingEvent({
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    rawBody,
  });

  if (!shouldProcess) {
    res.status(200).json({ success: true, duplicate: true });
    return;
  }

  try {
    const lifetimePurchase = extractPaddleLifetimePurchaseSnapshot(event);
    if (lifetimePurchase) {
      const result = await recordPaddleLifetimePurchase(lifetimePurchase);
      await finishBillingEvent(event.eventId, result.processed ? "processed" : "ignored", "reason" in result ? result.reason : null);
      res.status(200).json({ success: true, result });
      return;
    }

    const subscription = extractPaddleSubscriptionSnapshot(event);
    if (subscription) {
      const result = await upsertPaddleSubscription(subscription);
      await finishBillingEvent(event.eventId, result.processed ? "processed" : "ignored", "reason" in result ? result.reason : null);
      res.status(200).json({ success: true, result });
      return;
    }

    await finishBillingEvent(event.eventId, "ignored", "unsupported_event_type");
    res.status(200).json({ success: true, ignored: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process Paddle webhook";
    await finishBillingEvent(event.eventId, "failed", message);
    res.status(500).json({ success: false, error: message });
  }
}

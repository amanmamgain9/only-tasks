import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentUserFromRequest } from "@/server/auth";
import { createPaddleCustomerPortalSession, isPaddlePortalConfigured } from "@/server/billing/paddle";
import { getPaddleBillingContextForUser } from "@/server/subscriptions/service";
import { toWebRequest } from "@/server/api/helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const user = await getCurrentUserFromRequest(toWebRequest(req));
  if (!user) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  if (!isPaddlePortalConfigured()) {
    res.status(503).json({
      success: false,
      error: "Paddle portal is not configured. Add PADDLE_API_KEY.",
    });
    return;
  }

  const billingContext = await getPaddleBillingContextForUser(user.id);
  if (!billingContext.paddleCustomerId || billingContext.subscriptionIds.length === 0) {
    res.status(409).json({
      success: false,
      error: "Billing portal is only available after a Paddle subscription is linked to this account.",
    });
    return;
  }

  try {
    const url = await createPaddleCustomerPortalSession(
      billingContext.paddleCustomerId,
      billingContext.subscriptionIds,
    );
    res.status(200).json({ success: true, data: { url } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create Paddle portal session";
    res.status(500).json({ success: false, error: message });
  }
}

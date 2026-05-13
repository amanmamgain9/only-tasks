import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentUserFromRequest } from "@/server/auth";
import { getPaddleClientToken, getPublicPaddleEnvironment, isPaddleCheckoutConfigured } from "@/server/billing/paddle";
import { getPaddlePlanConfig, getPaddlePriceIdForCheckout, parsePaddlePlanKey } from "@/server/billing/plans";
import {
  continuePaddleMonthlyForUser,
  getPaddleBillingContextForUser,
  hasConsumedTrial,
  listSubscriptionsForUser,
} from "@/server/subscriptions/service";
import { resolveOrigin, toWebRequest } from "../auth/_helpers";

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

  const planKey = parsePaddlePlanKey(req.body?.plan);
  if (!planKey) {
    res.status(400).json({ success: false, error: "Invalid billing plan." });
    return;
  }

  if (!isPaddleCheckoutConfigured()) {
    res.status(503).json({
      success: false,
      error: "Paddle checkout is not configured. Add NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.",
    });
    return;
  }

  const planConfig = getPaddlePlanConfig(planKey);
  const subscriptionRows = await listSubscriptionsForUser(user.id);
  const trialEligible = !hasConsumedTrial(subscriptionRows);
  const priceId = getPaddlePriceIdForCheckout(planKey, { trialEligible });
  if (!priceId) {
    res.status(503).json({
      success: false,
      error: `Paddle price is not configured. Add ${planConfig.priceEnvVars.join(" or ")}.`,
    });
    return;
  }

  const subscription = user.subscription;
  if (subscription?.requiresBillingMigrationReview) {
    res.status(409).json({
      success: false,
      code: "subscription_requires_support",
      error: "This account has legacy billing that needs migration review before starting Paddle checkout.",
    });
    return;
  }

  if (subscription?.isEntitled && subscription.planKey === "lifetime") {
    res.status(409).json({
      success: false,
      code: "lifetime_access_active",
      error: "Lifetime access is already active for this account.",
    });
    return;
  }

  if (planKey === "pro_monthly") {
    const continuedMonthly = await continuePaddleMonthlyForUser(user.id);
    if (continuedMonthly.handled) {
      res.status(200).json({
        success: true,
        data: {
          kind: "subscription_updated",
          action: continuedMonthly.action,
          message: continuedMonthly.message,
        },
      });
      return;
    }
  }

  const origin = resolveOrigin(req);
  const successUrl = new URL("/app/workspace/all-tasks", origin);
  successUrl.searchParams.set("billing", "success");
  successUrl.searchParams.set("plan", planKey);

  const billingContext = await getPaddleBillingContextForUser(user.id);
  const customData = {
    app: "planmyworkday",
    userId: user.id,
    planKey,
  };

  res.status(200).json({
    success: true,
    data: {
      planKey,
      priceId,
      trialEligible,
      environment: getPublicPaddleEnvironment(),
      clientTokenConfigured: Boolean(getPaddleClientToken()),
      checkout: {
        settings: {
          displayMode: "overlay",
          successUrl: successUrl.toString(),
          variant: "one-page",
        },
        items: [
          {
            priceId,
            quantity: 1,
          },
        ],
        customer: billingContext.paddleCustomerId
          ? {
              id: billingContext.paddleCustomerId,
            }
          : {
              email: user.email,
            },
        customData,
      },
    },
  });
}

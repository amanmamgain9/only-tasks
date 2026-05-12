import type { AuthenticatedUser } from "../auth";

export class BillingRequiredError extends Error {
  constructor(message = "Billing required") {
    super(message);
    this.name = "BillingRequiredError";
  }
}

export function isBillingEnforcementEnabled() {
  return process.env.PLANMYWORKDAY_BILLING_ENFORCEMENT === "1" || process.env.PLANMYWORKDAY_BILLING_ENFORCEMENT === "true";
}

export function assertWorkspaceBillingAccess(user: AuthenticatedUser) {
  if (!isBillingEnforcementEnabled()) return;
  if (user.subscription?.isEntitled) return;
  throw new BillingRequiredError();
}

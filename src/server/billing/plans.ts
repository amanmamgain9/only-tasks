export const PADDLE_PLAN_KEYS = ["pro_monthly", "lifetime"] as const;

export type PaddlePlanKey = (typeof PADDLE_PLAN_KEYS)[number];

type PaddlePlanConfig = {
  planKey: PaddlePlanKey;
  label: string;
  checkoutLabel: string;
  priceLabel: string;
  description: string;
  priceEnvVars: readonly string[];
  trialDays: number;
};

function firstEnvValue(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getPaddleTrialDays() {
  return parsePositiveInteger(
    process.env.PADDLE_MONTHLY_TRIAL_DAYS ?? process.env.FREE_PRO_PLUS_TRIAL_DAYS,
    3,
  );
}

export function parsePaddlePlanKey(input: unknown): PaddlePlanKey | null {
  if (input === "monthly") return "pro_monthly";
  if (input === "pro_monthly" || input === "lifetime") return input;
  return null;
}

export function getPaddlePlanConfig(planKey: PaddlePlanKey): PaddlePlanConfig {
  const trialDays = getPaddleTrialDays();

  if (planKey === "lifetime") {
    return {
      planKey,
      label: "Lifetime",
      checkoutLabel: "Buy lifetime",
      priceLabel: process.env.PLANMYWORKDAY_LIFETIME_PRICE_LABEL || "One-time",
      description: "Pay once and keep access to the focused task workspace.",
      priceEnvVars: ["PADDLE_PRICE_ID_LIFETIME", "PADDLE_PRICE_ID_PRO_LIFETIME"],
      trialDays: 0,
    };
  }

  return {
    planKey,
    label: "Pro",
    checkoutLabel: trialDays > 0 ? `Start ${trialDays}-day trial` : "Start monthly",
    priceLabel: process.env.PLANMYWORKDAY_MONTHLY_PRICE_LABEL || "$4/mo",
    description: "Monthly access with Paddle-hosted billing and cancellation.",
    priceEnvVars: ["PADDLE_PRICE_ID_PRO_MONTHLY", "PADDLE_PRICE_ID_MONTHLY"],
    trialDays,
  };
}

export function getPaddlePriceId(planKey: PaddlePlanKey) {
  return firstEnvValue(getPaddlePlanConfig(planKey).priceEnvVars);
}

export function getPaddlePlanKeyForPrice(priceId: string | null | undefined): PaddlePlanKey | null {
  if (!priceId) return null;

  for (const planKey of PADDLE_PLAN_KEYS) {
    if (getPaddlePriceId(planKey) === priceId) return planKey;
  }

  return null;
}

export function listPaddlePlanConfigs() {
  return PADDLE_PLAN_KEYS.map((planKey) => ({
    ...getPaddlePlanConfig(planKey),
    priceId: getPaddlePriceId(planKey),
  }));
}

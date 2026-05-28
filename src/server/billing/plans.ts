const PADDLE_PLAN_KEYS = ["pro_monthly", "lifetime"] as const;

export type PaddlePlanKey = (typeof PADDLE_PLAN_KEYS)[number];

type PaddlePlanConfig = {
  planKey: PaddlePlanKey;
  label: string;
  checkoutLabel: string;
  priceLabel: string;
  description: string;
  priceEnvVars: readonly string[];
  matchingPriceEnvVars: readonly string[];
  trialDays: number;
};

function firstEnvValue(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

function getPriceLabel(envName: string, fallback: string) {
  const value = process.env[envName]?.trim();
  if (!value || value.startsWith("/")) return fallback;
  return value;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isDisabledFlag(value: string | undefined) {
  return value === "0" || value?.toLowerCase() === "false";
}

function getPaddleTrialDays() {
  const enabledValue =
    process.env.PADDLE_TRIAL_ENABLED ??
    process.env.PADDLE_MONTHLY_TRIAL_ENABLED ??
    process.env.PLANMYWORKDAY_ENABLE_MONTHLY_TRIAL;

  if (isDisabledFlag(enabledValue)) {
    return 0;
  }

  return parsePositiveInteger(
    process.env.PADDLE_TRIAL_DAYS ?? process.env.PADDLE_MONTHLY_TRIAL_DAYS ?? process.env.FREE_PRO_PLUS_TRIAL_DAYS,
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
    const trialPriceEnvVars = ["PADDLE_PRICE_ID_LIFETIME_10_YEAR"] as const;
    const noTrialPriceEnvVars = ["PADDLE_PRICE_ID_LIFETIME_10_YEAR_NO_TRIAL"] as const;

    return {
      planKey,
      label: "Lifetime",
      checkoutLabel: "Buy lifetime",
      priceLabel: getPriceLabel("PLANMYWORKDAY_LIFETIME_PRICE_LABEL", "$99"),
      description: "10 years of full workspace access for a single upfront payment.",
      priceEnvVars: noTrialPriceEnvVars,
      matchingPriceEnvVars: [...trialPriceEnvVars, ...noTrialPriceEnvVars],
      trialDays: 0,
    };
  }

  const trialPriceEnvVars = ["PADDLE_PRICE_ID_PRO_MONTHLY", "PADDLE_PRICE_ID_MONTHLY"] as const;
  const noTrialPriceEnvVars = ["PADDLE_PRICE_ID_PRO_MONTHLY_NO_TRIAL"] as const;
  const priceEnvVars = trialDays > 0 ? trialPriceEnvVars : noTrialPriceEnvVars;

  return {
    planKey,
    label: "Pro",
    checkoutLabel: trialDays > 0 ? `Start ${trialDays}-day trial` : "Start monthly",
    priceLabel: getPriceLabel("PLANMYWORKDAY_MONTHLY_PRICE_LABEL", "$4/mo"),
    description:
      trialDays > 0
        ? "Monthly access with a free trial and easy cancellation."
        : "Monthly access with easy cancellation.",
    priceEnvVars,
    matchingPriceEnvVars: [...trialPriceEnvVars, ...noTrialPriceEnvVars],
    trialDays,
  };
}

function getPaddlePriceId(planKey: PaddlePlanKey) {
  return firstEnvValue(getPaddlePlanConfig(planKey).priceEnvVars);
}

export function getPaddlePriceIdForCheckout(
  planKey: PaddlePlanKey,
  options?: {
    trialEligible?: boolean;
  },
) {
  const config = getPaddlePlanConfig(planKey);

  if (planKey === "pro_monthly" && config.trialDays > 0 && options?.trialEligible !== false) {
    return firstEnvValue(["PADDLE_PRICE_ID_PRO_MONTHLY", "PADDLE_PRICE_ID_MONTHLY"]);
  }

  if (planKey === "pro_monthly") {
    return firstEnvValue(["PADDLE_PRICE_ID_PRO_MONTHLY_NO_TRIAL"]) ?? firstEnvValue(["PADDLE_PRICE_ID_PRO_MONTHLY", "PADDLE_PRICE_ID_MONTHLY"]);
  }

  if (planKey === "lifetime" && config.trialDays > 0 && options?.trialEligible !== false) {
    return firstEnvValue(["PADDLE_PRICE_ID_LIFETIME_10_YEAR"]);
  }

  if (planKey === "lifetime") {
    return firstEnvValue(["PADDLE_PRICE_ID_LIFETIME_10_YEAR_NO_TRIAL"]) ?? firstEnvValue(["PADDLE_PRICE_ID_LIFETIME_10_YEAR"]);
  }

  return getPaddlePriceId(planKey);
}

export function getPaddlePlanKeyForPrice(priceId: string | null | undefined): PaddlePlanKey | null {
  if (!priceId) return null;

  for (const planKey of PADDLE_PLAN_KEYS) {
    const config = getPaddlePlanConfig(planKey);
    for (const envVar of config.matchingPriceEnvVars) {
      if (process.env[envVar] === priceId) return planKey;
    }
  }

  return null;
}

export function listPaddlePlanConfigs() {
  return PADDLE_PLAN_KEYS.map((planKey) => ({
    ...getPaddlePlanConfig(planKey),
    priceId: getPaddlePriceId(planKey),
  }));
}

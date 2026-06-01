export const TASK_CATEGORY_DEFINITIONS = [
  {
    id: "job",
    label: "Main Work",
    description: "Current job, client delivery, manager asks, and core employment work.",
  },
  {
    id: "side_project",
    label: "Side Project",
    description: "A project meant to create income, leverage, audience, or a real asset outside the main job.",
  },
  {
    id: "chore",
    label: "Chore",
    description: "Household, errands, bills, taxes, appointments, logistics, and life admin.",
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    description: "Learning, health, social, and hobby work that often overlap in real life.",
  },
] as const;

export type TaskCategoryId = (typeof TASK_CATEGORY_DEFINITIONS)[number]["id"];

export type TaskCategoryAllocation = {
  category: TaskCategoryId;
  weight: number;
};

export const LIFESTYLE_TRAIT_DEFINITIONS = [
  {
    id: "learning",
    label: "Learning",
    description: "Study, practice, research, courses, reading, and skill-building work.",
  },
  {
    id: "health",
    label: "Health",
    description: "Fitness, sleep, food, therapy, medical admin, recovery, and wellbeing.",
  },
  {
    id: "social",
    label: "Social",
    description: "Friends, family, calls, events, relationships, and community commitments.",
  },
  {
    id: "hobby",
    label: "Hobby",
    description: "Joy, creativity, games, art, music, personal interests, and non-outcome play.",
  },
] as const;

export type LifestyleTraitId = (typeof LIFESTYLE_TRAIT_DEFINITIONS)[number]["id"];

export type LifestyleTraitAllocation = {
  trait: LifestyleTraitId;
  weight: number;
};

export type ProjectCategorySeed = "main" | "side_project" | "chore";

export const CATEGORY_ROOT_DEFINITIONS: Array<{
  category: TaskCategoryId;
  title: string;
  hint: string;
}> = [
  {
    category: "job",
    title: "Main Work",
    hint: "Current job, client work, and primary professional commitments.",
  },
  {
    category: "side_project",
    title: "Side Project",
    hint: "Apps, businesses, creator work, and assets you are building outside the main job.",
  },
  {
    category: "chore",
    title: "Chore",
    hint: "Household, errands, bills, taxes, appointments, logistics, and life admin.",
  },
  {
    category: "lifestyle",
    title: "Lifestyle",
    hint: "Learning, health, social, and hobby work that blend together.",
  },
];

const TASK_CATEGORY_IDS = new Set<TaskCategoryId>(
  TASK_CATEGORY_DEFINITIONS.map((category) => category.id),
);

const LIFESTYLE_TRAIT_IDS = new Set<LifestyleTraitId>(
  LIFESTYLE_TRAIT_DEFINITIONS.map((trait) => trait.id),
);

const TASK_CATEGORY_ORDER = new Map<TaskCategoryId, number>(
  TASK_CATEGORY_DEFINITIONS.map((category, index) => [category.id, index]),
);

const LIFESTYLE_TRAIT_ORDER = new Map<LifestyleTraitId, number>(
  LIFESTYLE_TRAIT_DEFINITIONS.map((trait, index) => [trait.id, index]),
);

export function isTaskCategoryId(value: unknown): value is TaskCategoryId {
  return typeof value === "string" && TASK_CATEGORY_IDS.has(value as TaskCategoryId);
}

export function isLifestyleTraitId(value: unknown): value is LifestyleTraitId {
  return typeof value === "string" && LIFESTYLE_TRAIT_IDS.has(value as LifestyleTraitId);
}

export function getTaskCategoryLabel(category: TaskCategoryId) {
  return TASK_CATEGORY_DEFINITIONS.find((definition) => definition.id === category)?.label ?? category;
}

export function getLifestyleTraitLabel(trait: LifestyleTraitId) {
  return LIFESTYLE_TRAIT_DEFINITIONS.find((definition) => definition.id === trait)?.label ?? trait;
}

export function getCategoryRootTitle(category: TaskCategoryId) {
  return CATEGORY_ROOT_DEFINITIONS.find((definition) => definition.category === category)?.title ?? getTaskCategoryLabel(category);
}

export function getDefaultTaskCategoryAllocations(
  projectType?: ProjectCategorySeed | null,
): TaskCategoryAllocation[] {
  if (projectType === "side_project") return [{ category: "side_project", weight: 100 }];
  if (projectType === "chore") return [{ category: "chore", weight: 100 }];
  return [{ category: "job", weight: 100 }];
}

function parseUnknownAllocations(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeToHundred<TAllocation extends { weight: number }>(
  allocations: TAllocation[],
  order: (allocation: TAllocation) => number,
): TAllocation[] {
  const total = allocations.reduce((sum, allocation) => sum + allocation.weight, 0);
  if (total === 100) return allocations;
  if (total <= 0) return [];

  const scaled = allocations.map((allocation) => ({
    ...allocation,
    weight: Math.max(1, Math.round((allocation.weight / total) * 100)),
  }));

  let diff = 100 - scaled.reduce((sum, allocation) => sum + allocation.weight, 0);
  while (diff !== 0) {
    const target = scaled
      .slice()
      .sort((a, b) => b.weight - a.weight || order(a) - order(b))
      .find((allocation) => diff > 0 || allocation.weight > 1);

    if (!target) break;
    target.weight += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }

  return scaled.filter((allocation) => allocation.weight > 0);
}

export function normalizeTaskCategoryAllocations(
  value: unknown,
  options: { projectType?: ProjectCategorySeed | null } = {},
): TaskCategoryAllocation[] {
  const fallback = getDefaultTaskCategoryAllocations(options.projectType);
  const rawAllocations = parseUnknownAllocations(value);
  if (!rawAllocations) return fallback;

  const byCategory = new Map<TaskCategoryId, number>();
  const orderedCategories: TaskCategoryId[] = [];

  for (const rawAllocation of rawAllocations) {
    if (!rawAllocation || typeof rawAllocation !== "object") continue;

    const record = rawAllocation as Record<string, unknown>;
    const category = record.category ?? record.categoryId ?? record.id;
    const rawWeight = record.weight ?? record.percentage ?? record.percent;
    const weight = Number(rawWeight);

    const normalizedCategory = isTaskCategoryId(category)
      ? category
      : isLifestyleTraitId(category)
        ? "lifestyle"
        : null;
    if (!normalizedCategory) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;

    if (!byCategory.has(normalizedCategory)) orderedCategories.push(normalizedCategory);
    byCategory.set(normalizedCategory, (byCategory.get(normalizedCategory) ?? 0) + Math.round(weight));
  }

  let allocations = orderedCategories.map((category) => ({
    category,
    weight: byCategory.get(category) ?? 0,
  })).filter((allocation) => allocation.weight > 0);

  if (allocations.length === 0) return fallback;

  if (allocations.length > 3) {
    allocations = allocations
      .slice()
      .sort((a, b) => b.weight - a.weight || (TASK_CATEGORY_ORDER.get(a.category) ?? 0) - (TASK_CATEGORY_ORDER.get(b.category) ?? 0))
      .slice(0, 3);
  }

  const normalized = normalizeToHundred(allocations, (allocation) => TASK_CATEGORY_ORDER.get(allocation.category) ?? 0);
  return normalized.length > 0 ? normalized : fallback;
}

export function validateTaskCategoryAllocations(value: unknown):
  | { ok: true; allocations: TaskCategoryAllocation[] }
  | { ok: false; error: string } {
  const rawAllocations = parseUnknownAllocations(value);
  if (!rawAllocations) return { ok: false, error: "Category allocation must be an array." };
  if (rawAllocations.length < 1) return { ok: false, error: "Choose at least one category." };
  if (rawAllocations.length > 3) return { ok: false, error: "Use at most three categories per task." };

  const seen = new Set<TaskCategoryId>();
  const allocations: TaskCategoryAllocation[] = [];

  for (const rawAllocation of rawAllocations) {
    if (!rawAllocation || typeof rawAllocation !== "object") {
      return { ok: false, error: "Each category allocation must be an object." };
    }

    const record = rawAllocation as Record<string, unknown>;
    const category = record.category ?? record.categoryId ?? record.id;
    const weight = Number(record.weight ?? record.percentage ?? record.percent);

    if (!isTaskCategoryId(category)) return { ok: false, error: "Choose a supported category." };
    if (seen.has(category)) return { ok: false, error: "A category can only be used once per task." };
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) {
      return { ok: false, error: "Category percentages must be whole numbers from 1 to 100." };
    }

    seen.add(category);
    allocations.push({ category, weight });
  }

  const total = allocations.reduce((sum, allocation) => sum + allocation.weight, 0);
  if (total !== 100) return { ok: false, error: "Category percentages must add up to 100%." };

  return { ok: true, allocations };
}

export function serializeTaskCategoryAllocations(value: unknown): string {
  const result = validateTaskCategoryAllocations(value);
  if (!result.ok) throw new Error(result.error);
  return JSON.stringify(result.allocations);
}

export function normalizeLifestyleTraitAllocations(value: unknown): LifestyleTraitAllocation[] {
  const rawAllocations = parseUnknownAllocations(value);
  if (!rawAllocations) return [];

  const byTrait = new Map<LifestyleTraitId, number>();
  const orderedTraits: LifestyleTraitId[] = [];

  for (const rawAllocation of rawAllocations) {
    if (!rawAllocation || typeof rawAllocation !== "object") continue;

    const record = rawAllocation as Record<string, unknown>;
    const trait = record.trait ?? record.traitId ?? record.category ?? record.categoryId ?? record.id;
    const rawWeight = record.weight ?? record.percentage ?? record.percent;
    const weight = Number(rawWeight);

    if (!isLifestyleTraitId(trait)) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;

    if (!byTrait.has(trait)) orderedTraits.push(trait);
    byTrait.set(trait, (byTrait.get(trait) ?? 0) + Math.round(weight));
  }

  let allocations = orderedTraits.map((trait) => ({
    trait,
    weight: byTrait.get(trait) ?? 0,
  })).filter((allocation) => allocation.weight > 0);

  if (allocations.length === 0) return [];
  if (allocations.length > LIFESTYLE_TRAIT_DEFINITIONS.length) {
    allocations = allocations
      .slice()
      .sort((a, b) => b.weight - a.weight || (LIFESTYLE_TRAIT_ORDER.get(a.trait) ?? 0) - (LIFESTYLE_TRAIT_ORDER.get(b.trait) ?? 0))
      .slice(0, LIFESTYLE_TRAIT_DEFINITIONS.length);
  }

  return normalizeToHundred(allocations, (allocation) => LIFESTYLE_TRAIT_ORDER.get(allocation.trait) ?? 0);
}

export function validateLifestyleTraitAllocations(value: unknown):
  | { ok: true; allocations: LifestyleTraitAllocation[] }
  | { ok: false; error: string } {
  const rawAllocations = parseUnknownAllocations(value);
  if (!rawAllocations) return { ok: false, error: "Lifestyle traits must be an array." };
  if (rawAllocations.length < 1) return { ok: false, error: "Choose at least one lifestyle trait." };
  if (rawAllocations.length > LIFESTYLE_TRAIT_DEFINITIONS.length) {
    return { ok: false, error: "Use each lifestyle trait at most once." };
  }

  const seen = new Set<LifestyleTraitId>();
  const allocations: LifestyleTraitAllocation[] = [];

  for (const rawAllocation of rawAllocations) {
    if (!rawAllocation || typeof rawAllocation !== "object") {
      return { ok: false, error: "Each lifestyle trait allocation must be an object." };
    }

    const record = rawAllocation as Record<string, unknown>;
    const trait = record.trait ?? record.traitId ?? record.category ?? record.categoryId ?? record.id;
    const weight = Number(record.weight ?? record.percentage ?? record.percent);

    if (!isLifestyleTraitId(trait)) return { ok: false, error: "Choose a supported lifestyle trait." };
    if (seen.has(trait)) return { ok: false, error: "A lifestyle trait can only be used once per task." };
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) {
      return { ok: false, error: "Lifestyle trait percentages must be whole numbers from 1 to 100." };
    }

    seen.add(trait);
    allocations.push({ trait, weight });
  }

  const total = allocations.reduce((sum, allocation) => sum + allocation.weight, 0);
  if (total !== 100) return { ok: false, error: "Lifestyle trait percentages must add up to 100%." };

  return { ok: true, allocations };
}

export function serializeLifestyleTraitAllocations(value: unknown): string {
  const result = validateLifestyleTraitAllocations(value);
  if (!result.ok) throw new Error(result.error);
  return JSON.stringify(result.allocations);
}

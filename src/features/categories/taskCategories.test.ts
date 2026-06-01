import { describe, expect, test } from "vitest";
import {
  getDefaultTaskCategoryAllocations,
  normalizeLifestyleTraitAllocations,
  normalizeTaskCategoryAllocations,
  serializeLifestyleTraitAllocations,
  serializeTaskCategoryAllocations,
  validateLifestyleTraitAllocations,
  validateTaskCategoryAllocations,
} from "./taskCategories";

describe("task categories", () => {
  test("defaults from the project type without using an uncategorized bucket", () => {
    expect(getDefaultTaskCategoryAllocations("main")).toEqual([{ category: "job", weight: 100 }]);
    expect(getDefaultTaskCategoryAllocations("side_project")).toEqual([{ category: "side_project", weight: 100 }]);
    expect(getDefaultTaskCategoryAllocations("chore")).toEqual([{ category: "chore", weight: 100 }]);
  });

  test("validates manual allocations as one to three whole-number percentages totaling 100", () => {
    const result = validateTaskCategoryAllocations([
      { category: "side_project", weight: 70 },
      { category: "lifestyle", weight: 20 },
      { category: "chore", weight: 10 },
    ]);

    expect(result).toEqual({
      ok: true,
      allocations: [
        { category: "side_project", weight: 70 },
        { category: "lifestyle", weight: 20 },
        { category: "chore", weight: 10 },
      ],
    });
  });

  test("rejects duplicate categories and totals that do not add up to 100", () => {
    expect(validateTaskCategoryAllocations([
      { category: "lifestyle", weight: 70 },
      { category: "lifestyle", weight: 30 },
    ])).toMatchObject({ ok: false });

    expect(validateTaskCategoryAllocations([
      { category: "lifestyle", weight: 70 },
      { category: "chore", weight: 20 },
    ])).toMatchObject({ ok: false });
  });

  test("normalizes legacy or malformed allocations to a valid percentage split", () => {
    expect(normalizeTaskCategoryAllocations([
      { category: "side_project", weight: 2 },
      { category: "lifestyle", weight: 1 },
    ])).toEqual([
      { category: "side_project", weight: 67 },
      { category: "lifestyle", weight: 33 },
    ]);

    expect(normalizeTaskCategoryAllocations(null, { projectType: "chore" })).toEqual([
      { category: "chore", weight: 100 },
    ]);
  });

  test("maps legacy learning health social hobby categories into the lifestyle root", () => {
    expect(normalizeTaskCategoryAllocations([
      { category: "health", weight: 50 },
      { category: "hobby", weight: 50 },
    ])).toEqual([{ category: "lifestyle", weight: 100 }]);
  });

  test("serializes only valid manual category percentages", () => {
    expect(serializeTaskCategoryAllocations([{ category: "lifestyle", weight: 100 }])).toBe('[{"category":"lifestyle","weight":100}]');
    expect(() => serializeTaskCategoryAllocations([{ category: "lifestyle", weight: 80 }])).toThrow(/100%/);
  });

  test("validates and normalizes lifestyle trait percentages separately from roots", () => {
    expect(validateLifestyleTraitAllocations([
      { trait: "health", weight: 40 },
      { trait: "social", weight: 30 },
      { trait: "hobby", weight: 30 },
    ])).toEqual({
      ok: true,
      allocations: [
        { trait: "health", weight: 40 },
        { trait: "social", weight: 30 },
        { trait: "hobby", weight: 30 },
      ],
    });

    expect(normalizeLifestyleTraitAllocations([
      { category: "health", weight: 2 },
      { category: "hobby", weight: 1 },
    ])).toEqual([
      { trait: "health", weight: 67 },
      { trait: "hobby", weight: 33 },
    ]);

    expect(serializeLifestyleTraitAllocations([{ trait: "learning", weight: 100 }])).toBe('[{"trait":"learning","weight":100}]');
  });
});

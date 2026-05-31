import { describe, expect, test } from "vitest";
import {
  getDefaultTaskCategoryAllocations,
  normalizeTaskCategoryAllocations,
  serializeTaskCategoryAllocations,
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
      { category: "learning", weight: 20 },
      { category: "health", weight: 10 },
    ]);

    expect(result).toEqual({
      ok: true,
      allocations: [
        { category: "side_project", weight: 70 },
        { category: "learning", weight: 20 },
        { category: "health", weight: 10 },
      ],
    });
  });

  test("rejects duplicate categories and totals that do not add up to 100", () => {
    expect(validateTaskCategoryAllocations([
      { category: "health", weight: 70 },
      { category: "health", weight: 30 },
    ])).toMatchObject({ ok: false });

    expect(validateTaskCategoryAllocations([
      { category: "health", weight: 70 },
      { category: "hobby", weight: 20 },
    ])).toMatchObject({ ok: false });
  });

  test("normalizes legacy or malformed allocations to a valid percentage split", () => {
    expect(normalizeTaskCategoryAllocations([
      { category: "side_project", weight: 2 },
      { category: "learning", weight: 1 },
    ])).toEqual([
      { category: "side_project", weight: 67 },
      { category: "learning", weight: 33 },
    ]);

    expect(normalizeTaskCategoryAllocations(null, { projectType: "chore" })).toEqual([
      { category: "chore", weight: 100 },
    ]);
  });

  test("serializes only valid manual category percentages", () => {
    expect(serializeTaskCategoryAllocations([{ category: "social", weight: 100 }])).toBe('[{"category":"social","weight":100}]');
    expect(() => serializeTaskCategoryAllocations([{ category: "social", weight: 80 }])).toThrow(/100%/);
  });
});

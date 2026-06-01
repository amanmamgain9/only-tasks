import { describe, expect, it } from "vitest";
import {
  appendRolloverHistory,
  dateKeyToDueDate,
  dueDateToDateKey,
  parseRolloverHistory,
} from "./rolloverMetadata";

describe("rollover metadata", () => {
  it("normalizes scheduled date storage and extracts date keys", () => {
    expect(dateKeyToDueDate("2026-06-02")).toBe("2026-06-02T00:00:00.000Z");
    expect(dueDateToDateKey("2026-06-02T00:00:00.000Z")).toBe("2026-06-02");
    expect(dueDateToDateKey("2026-06-02")).toBe("2026-06-02");
    expect(dueDateToDateKey(null)).toBeNull();
  });

  it("appends rollover dates without duplicating the same transition", () => {
    const first = appendRolloverHistory({
      existingHistory: null,
      fromDate: "2026-06-01",
      toDate: "2026-06-02",
      at: "2026-06-01T18:30:00.000Z",
    });
    const duplicate = appendRolloverHistory({
      existingHistory: first,
      fromDate: "2026-06-01",
      toDate: "2026-06-02",
      at: "2026-06-01T18:31:00.000Z",
    });
    const next = appendRolloverHistory({
      existingHistory: duplicate,
      fromDate: "2026-06-02",
      toDate: "2026-06-03",
      at: "2026-06-02T18:30:00.000Z",
    });

    expect(parseRolloverHistory(next)).toEqual([
      { from: "2026-06-01", to: "2026-06-02", at: "2026-06-01T18:30:00.000Z" },
      { from: "2026-06-02", to: "2026-06-03", at: "2026-06-02T18:30:00.000Z" },
    ]);
  });
});

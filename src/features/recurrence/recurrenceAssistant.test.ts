import { describe, expect, test } from "vitest";
import { createRecurrenceAssistantResultFromSchedule, parseRecurrencePrompt, summarizeRecurrenceSchedule } from "./recurrenceAssistant";

describe("recurrence assistant", () => {
  test("turns a daily phrase into a deterministic daily schedule", () => {
    const result = parseRecurrencePrompt("every day", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: { mode: "daily", startDate: "2026-06-03", interval: 1 },
        previewDates: ["2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08"],
      },
    });
  });

  test("keeps Monday through Friday phrases out of weekend previews", () => {
    const result = parseRecurrencePrompt("Monday through Friday until 2026-06-09", { todayDate: "2026-06-05" });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: { mode: "weekdays", startDate: "2026-06-05", endDate: "2026-06-09" },
        previewDates: ["2026-06-05", "2026-06-08", "2026-06-09"],
      },
    });
  });

  test("parses interval weekly phrases with named weekdays", () => {
    const result = parseRecurrencePrompt("every two weeks on Friday", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: { mode: "weekly", startDate: "2026-06-05", interval: 2, weekdays: [5] },
        previewDates: ["2026-06-05", "2026-06-19", "2026-07-03", "2026-07-17", "2026-07-31", "2026-08-14"],
      },
    });
  });

  test("parses every-other weekday language without requiring machine date wording", () => {
    const result = parseRecurrencePrompt("every other Friday until the end of June", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: { mode: "weekly", startDate: "2026-06-05", endDate: "2026-06-30", interval: 2, weekdays: [5] },
        summary: "Every other Friday starting Jun 5, 2026 until Jun 30, 2026",
        previewDates: ["2026-06-05", "2026-06-19"],
      },
    });
  });

  test("parses weekly quota language without inventing weekdays", () => {
    const result = parseRecurrencePrompt("atleast 3 days in a week", { todayDate: "2026-06-03" });

    expect(result).toEqual({
      ok: true,
      draft: {
        recurrence: {
          mode: "weekly_quota",
          startDate: "2026-06-03",
          endDate: null,
          targetCount: 3,
          comparator: "at_least",
        },
        summary: "At least 3 times per week starting Jun 3, 2026",
        previewDates: [],
      },
    });
  });

  test("parses compact weekly quota language", () => {
    const result = parseRecurrencePrompt("3x/week until the end of June", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: {
          mode: "weekly_quota",
          startDate: "2026-06-03",
          endDate: "2026-06-30",
          targetCount: 3,
          comparator: "at_least",
        },
        previewDates: [],
      },
    });
  });

  test("parses loose human weekly target language without an explicit period", () => {
    const result = parseRecurrencePrompt("do it like 3 time atleast maybe", { todayDate: "2026-06-03" });

    expect(result).toEqual({
      ok: true,
      draft: {
        recurrence: {
          mode: "weekly_quota",
          startDate: "2026-06-03",
          endDate: null,
          targetCount: 3,
          comparator: "at_least",
        },
        summary: "At least 3 times per week starting Jun 3, 2026",
        previewDates: [],
      },
    });
  });

  test("parses at-least target wording when the qualifier comes after the count", () => {
    const result = parseRecurrencePrompt("three times at least", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: {
          mode: "weekly_quota",
          startDate: "2026-06-03",
          targetCount: 3,
          comparator: "at_least",
        },
      },
    });
  });

  test("parses daily quota language for multiple completions per day", () => {
    const result = parseRecurrencePrompt("drink water 8 times a day", { todayDate: "2026-06-03" });

    expect(result).toEqual({
      ok: true,
      draft: {
        recurrence: {
          mode: "daily_quota",
          startDate: "2026-06-03",
          endDate: null,
          targetCount: 8,
          comparator: "at_least",
        },
        summary: "At least 8 times per day starting Jun 3, 2026",
        previewDates: [],
      },
    });
  });

  test("allows high daily quota counts that the recurrence engine accepts", () => {
    const result = parseRecurrencePrompt("do it 50 times a day", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: {
          mode: "daily_quota",
          startDate: "2026-06-03",
          targetCount: 50,
        },
      },
    });
  });

  test("rejects maximum quota wording instead of inverting it to at least", () => {
    expect(parseRecurrencePrompt("at most 3 days a week", { todayDate: "2026-06-03" })).toMatchObject({
      ok: false,
      message: "Maximum-style repeat targets are not supported yet. Use an at-least target instead.",
    });

    expect(parseRecurrencePrompt("no more than 3 times a day", { todayDate: "2026-06-03" })).toMatchObject({
      ok: false,
      message: "Maximum-style repeat targets are not supported yet. Use an at-least target instead.",
    });
  });

  test("rejects exact quota wording instead of weakening it to at least", () => {
    expect(parseRecurrencePrompt("exactly 3 times a week", { todayDate: "2026-06-03" })).toMatchObject({
      ok: false,
      message: "Exact repeat targets are not supported yet. Use an at-least target instead.",
    });
  });

  test("understands a human end-of-month phrase", () => {
    const result = parseRecurrencePrompt("every weekday until the end of June", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: { mode: "weekdays", startDate: "2026-06-03", endDate: "2026-06-30" },
      },
    });
  });

  test("understands human month-day end dates", () => {
    const result = parseRecurrencePrompt("every day until July 4", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: { mode: "daily", startDate: "2026-06-03", endDate: "2026-07-04" },
      },
    });
  });

  test("rejects unparseable end-date instructions instead of clearing the end date", () => {
    const result = parseRecurrencePrompt("every day until 2026-02-31", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: false,
      message: "The repeat end date is invalid.",
    });
  });

  test("rejects monthly phrases because the recurrence engine does not support them", () => {
    const result = parseRecurrencePrompt("every month on the 7th", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: false,
      message: "Monthly and yearly repeats are not supported by the current recurrence engine yet.",
    });
  });

  test("rejects schedules whose end date is before the start date", () => {
    const result = parseRecurrencePrompt("daily from 2026-06-10 until 2026-06-05", { todayDate: "2026-06-03" });

    expect(result).toMatchObject({
      ok: false,
      message: "The end date is before the start date.",
    });
  });

  test("rejects malformed explicit start dates instead of falling back to today", () => {
    expect(parseRecurrencePrompt("daily from 2026-02-31", { todayDate: "2026-06-03" })).toMatchObject({
      ok: false,
      message: "The repeat start date is invalid.",
    });
  });

  test("rejects malformed provided end dates instead of dropping them", () => {
    expect(createRecurrenceAssistantResultFromSchedule({
      mode: "daily",
      startDate: "2026-06-03",
      endDate: "2026-02-31",
    })).toMatchObject({
      ok: false,
      message: "The repeat end date is invalid.",
    });
  });

  test("summarizes an existing schedule for the assistant context", () => {
    expect(summarizeRecurrenceSchedule({
      mode: "weekly",
      startDate: "2026-06-05",
      interval: 2,
      weekdays: [5],
    })).toBe("Every other Friday starting Jun 5, 2026");
  });

  test("turns natural language removal into a no-repeat schedule", () => {
    const result = parseRecurrencePrompt("stop repeating", {
      todayDate: "2026-06-03",
      existingSchedule: { mode: "weekdays", startDate: "2026-06-01" },
    });

    expect(result).toEqual({
      ok: true,
      draft: {
        recurrence: { mode: "none" },
        summary: "This will stop repeating.",
        previewDates: [],
      },
    });
  });

  test("uses the existing draft when a follow-up only changes the start date", () => {
    const result = parseRecurrencePrompt("start next week", {
      todayDate: "2026-06-03",
      existingSchedule: { mode: "weekdays", startDate: "2026-06-01" },
    });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: { mode: "weekdays", startDate: "2026-06-10" },
        previewDates: ["2026-06-10", "2026-06-11", "2026-06-12", "2026-06-15", "2026-06-16", "2026-06-17"],
      },
    });
  });

  test("anchors named-weekday edits from the existing recurrence start", () => {
    const result = parseRecurrencePrompt("move it to Mondays", {
      todayDate: "2026-06-03",
      existingSchedule: { mode: "weekly", startDate: "2026-07-01", endDate: "2026-08-01", interval: 2, weekdays: [5] },
    });

    expect(result).toMatchObject({
      ok: true,
      draft: {
        recurrence: {
          mode: "weekly",
          startDate: "2026-07-06",
          endDate: "2026-08-01",
          interval: 2,
          weekdays: [1],
        },
      },
    });
  });
});

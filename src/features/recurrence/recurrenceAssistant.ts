export type RecurrenceAssistantSchedule =
  | { mode: "none" }
  | { mode: "daily"; startDate: string; endDate?: string | null; interval?: number }
  | { mode: "daily_quota"; startDate: string; endDate?: string | null; targetCount: number; comparator?: "at_least" }
  | { mode: "weekdays"; startDate: string; endDate?: string | null }
  | { mode: "weekly"; startDate: string; endDate?: string | null; interval?: number; weekdays?: number[] }
  | { mode: "weekly_quota"; startDate: string; endDate?: string | null; targetCount: number; comparator?: "at_least" };

export type RecurrenceAssistantDraft = {
  recurrence: RecurrenceAssistantSchedule;
  summary: string;
  previewDates: string[];
};

export type RecurrenceAssistantResult =
  | { ok: true; draft: RecurrenceAssistantDraft }
  | { ok: false; message: string; suggestions: string[] };

type ParseOptions = {
  todayDate?: string;
  initialStartDate?: string | null;
  existingSchedule?: RecurrenceAssistantSchedule | null;
  previewCount?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MENTION_RE = /\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/g;
const START_PREFIX = "starting|starts|start|from|beginning|begins|begin";
const END_PREFIX = "until|through|ending|ends|end|stopping|stop";
const MAX_DAILY_QUOTA_TARGET = 99;
const MAX_WEEKLY_QUOTA_TARGET = 31;

const WEEKDAYS = [
  { value: 0, label: "Sunday", aliases: ["sunday", "sun"] },
  { value: 1, label: "Monday", aliases: ["monday", "mon"] },
  { value: 2, label: "Tuesday", aliases: ["tuesday", "tue", "tues"] },
  { value: 3, label: "Wednesday", aliases: ["wednesday", "wed"] },
  { value: 4, label: "Thursday", aliases: ["thursday", "thu", "thur", "thurs"] },
  { value: 5, label: "Friday", aliases: ["friday", "fri"] },
  { value: 6, label: "Saturday", aliases: ["saturday", "sat"] },
] as const;

const SUGGESTIONS = [
  "Every weekday",
  "Every Monday",
  "Every other Friday",
  "At least 3 days a week",
  "8 times a day",
  "Until the end of June",
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
};

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function padDatePart(value: string) {
  return value.padStart(2, "0");
}

function dateKeyFromParts(year: string, month: string, day: string) {
  const dateKey = `${year}-${padDatePart(month)}-${padDatePart(day)}`;
  return isValidDateKey(dateKey) ? dateKey : null;
}

function dateKeyToTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function addDays(dateKey: string, days: number) {
  return new Date(dateKeyToTime(dateKey) + days * DAY_MS).toISOString().slice(0, 10);
}

function diffDays(startDate: string, endDate: string) {
  return Math.floor((dateKeyToTime(endDate) - dateKeyToTime(startDate)) / DAY_MS);
}

function getUtcWeekday(dateKey: string) {
  return new Date(dateKeyToTime(dateKey)).getUTCDay();
}

function isValidDateKey(value: string | null | undefined): value is string {
  if (!value || !DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function normalizeDateInput(value: string | null | undefined) {
  if (!value) return null;
  const dateOnly = value.includes("T") ? value.slice(0, 10) : value.replace(/\//g, "-");
  return isValidDateKey(dateOnly) ? dateOnly : null;
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizePrompt(prompt: string) {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function getDateMentions(text: string) {
  const mentions: Array<{ dateKey: string; index: number }> = [];
  for (const match of text.matchAll(DATE_MENTION_RE)) {
    const dateKey = dateKeyFromParts(match[1], match[2], match[3]);
    if (dateKey) mentions.push({ dateKey, index: match.index ?? 0 });
  }
  return mentions;
}

function getWeekdayByAlias(alias: string) {
  return WEEKDAYS.find((weekday) => (weekday.aliases as readonly string[]).includes(alias));
}

function getWeekdayLabel(weekday: number) {
  return WEEKDAYS.find((day) => day.value === weekday)?.label ?? "day";
}

function getMentionedWeekdays(text: string) {
  const values: number[] = [];
  for (const weekday of WEEKDAYS) {
    for (const alias of weekday.aliases) {
      const expression = new RegExp(`\\b${alias}s?\\b`);
      if (expression.test(text)) {
        values.push(weekday.value);
        break;
      }
    }
  }
  if (/\b(weekend|weekends)\b/.test(text)) values.push(0, 6);
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function parseRelativeDateToken(token: string, todayDate: string) {
  if (token === "today") return todayDate;
  if (token === "tomorrow") return addDays(todayDate, 1);
  if (token === "next week") return addDays(todayDate, 7);

  const nextWeekday = /^next\s+([a-z]+)$/.exec(token);
  if (nextWeekday) {
    const weekday = getWeekdayByAlias(nextWeekday[1]);
    if (!weekday) return null;
    return getNextWeekdayDate(todayDate, weekday.value, false);
  }

  const dateMatch = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(token);
  if (dateMatch) return dateKeyFromParts(dateMatch[1], dateMatch[2], dateMatch[3]);
  return null;
}

function parseEndOfMonthMention(text: string, todayDate: string) {
  const match = /\b(?:until|through|ending|ends|end)\s+(?:the\s+)?end\s+of\s+([a-z]+)\b/.exec(text);
  if (!match) return null;
  const month = MONTH_NAMES[match[1]];
  if (!month) return null;

  const todayYear = Number.parseInt(todayDate.slice(0, 4), 10);
  const todayMonth = Number.parseInt(todayDate.slice(5, 7), 10);
  const year = month < todayMonth ? todayYear + 1 : todayYear;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
}

function parseDateAfterPrefix(text: string, prefix: string, todayDate: string) {
  const tokenPattern = "(today|tomorrow|next\\s+week|next\\s+[a-z]+|\\d{4}[/-]\\d{1,2}[/-]\\d{1,2})";
  const expression = new RegExp(`\\b(?:${prefix})(?:\\s+on)?\\s+${tokenPattern}\\b`);
  const match = expression.exec(text);
  if (!match) return null;
  return parseRelativeDateToken(match[1], todayDate);
}

function parseMonthDayAfterPrefix(text: string, prefix: string, todayDate: string) {
  const monthPattern = Object.keys(MONTH_NAMES).join("|");
  const expression = new RegExp(`\\b(?:${prefix})(?:\\s+on)?\\s+(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`);
  const match = expression.exec(text);
  if (!match) return null;

  const month = MONTH_NAMES[match[1]];
  const day = Number.parseInt(match[2], 10);
  const todayYear = Number.parseInt(todayDate.slice(0, 4), 10);
  const todayMonth = Number.parseInt(todayDate.slice(5, 7), 10);
  const todayDay = Number.parseInt(todayDate.slice(8, 10), 10);
  const year = match[3]
    ? Number.parseInt(match[3], 10)
    : month < todayMonth || (month === todayMonth && day < todayDay)
      ? todayYear + 1
      : todayYear;

  return dateKeyFromParts(year.toString(), month.toString(), day.toString());
}

function parseStartDateAfterPrefix(text: string, todayDate: string) {
  return parseDateAfterPrefix(text, START_PREFIX, todayDate)
    ?? parseMonthDayAfterPrefix(text, START_PREFIX, todayDate);
}

function hasStartDateCandidate(text: string) {
  const monthPattern = Object.keys(MONTH_NAMES).join("|");
  const tokenPattern = [
    "today",
    "tomorrow",
    "next\\s+week",
    "next\\s+[a-z]+",
    "\\d{4}[/-]\\d{1,2}[/-]\\d{1,2}",
    `(?:${monthPattern})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?`,
  ].join("|");
  const expression = new RegExp(`\\b(?:${START_PREFIX})(?:\\s+on)?\\s+(?:${tokenPattern})\\b`);
  return expression.test(text);
}

function parseStartDate(text: string, todayDate: string, initialStartDate: string | null, endDate: string | null) {
  const start = parseStartDateAfterPrefix(text, todayDate);
  if (start) return start;

  const dateMention = getDateMentions(text).find((mention) => mention.dateKey !== endDate);
  if (dateMention) return dateMention.dateKey;

  return initialStartDate ?? todayDate;
}

function parseEndDate(text: string, todayDate: string) {
  return parseEndOfMonthMention(text, todayDate)
    ?? parseDateAfterPrefix(text, END_PREFIX, todayDate)
    ?? parseMonthDayAfterPrefix(text, END_PREFIX, todayDate);
}

function getNextWeekdayDate(todayDate: string, weekday: number, includeToday: boolean) {
  const todayWeekday = getUtcWeekday(todayDate);
  let daysUntil = (weekday - todayWeekday + 7) % 7;
  if (!includeToday && daysUntil === 0) daysUntil = 7;
  return addDays(todayDate, daysUntil);
}

function getNextMatchingWeekdayDate(todayDate: string, weekdays: number[]) {
  const sorted = [...weekdays].sort((a, b) => a - b);
  const candidates = sorted.map((weekday) => getNextWeekdayDate(todayDate, weekday, true));
  return candidates.sort()[0] ?? todayDate;
}

function getInterval(text: string, unit: "day" | "week") {
  const expression = new RegExp(`\\bevery\\s+(\\d+|${Object.keys(NUMBER_WORDS).join("|")})\\s+${unit}s?\\b`);
  const match = expression.exec(text);
  if (!match) return null;
  const interval = parseNumberToken(match[1]);
  return Number.isInteger(interval) && interval > 0 ? interval : null;
}

function parseNumberToken(value: string) {
  return NUMBER_WORDS[value] ?? Number.parseInt(value, 10);
}

function getEveryOtherInterval(text: string, unit: "day" | "week", hasNamedWeekday: boolean) {
  if (unit === "day") {
    return /\b(?:every\s+other|alternate)\s+days?\b/.test(text) ? 2 : null;
  }

  if (/\b(?:every\s+other|alternate)\s+weeks?\b/.test(text)) return 2;
  if (hasNamedWeekday && /\b(?:every\s+other|alternate)\b/.test(text)) return 2;
  return null;
}

function parseQuota(text: string, unit: "day" | "week") {
  const numberPattern = `\\d+|${Object.keys(NUMBER_WORDS).join("|")}`;
  const maxTargetCount = unit === "day" ? MAX_DAILY_QUOTA_TARGET : MAX_WEEKLY_QUOTA_TARGET;
  const expression = new RegExp(
    `\\b(?:(at\\s*least|atleast|minimum|min|at\\s+minimum)\\s+)?(${numberPattern})\\s*(?:x|times?|days?|sessions?|glasses?)\\s*(?:/\\s*${unit}|(?:a|per|in\\s+a|each|every)\\s+${unit}|${unit === "day" ? "daily" : "weekly"})\\b`,
  );
  const match = expression.exec(text);
  if (!match) return null;
  const targetCount = parseNumberToken(match[2]);
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > maxTargetCount) return null;
  return {
    targetCount,
    comparator: match[1] ? "at_least" as const : undefined,
  };
}

function hasUnsupportedQuotaCeiling(text: string) {
  const numberPattern = `\\d+|${Object.keys(NUMBER_WORDS).join("|")}`;
  const targetUnit = "x|times?|days?|sessions?|glasses?";
  const period = "\\/\\s*(?:day|week)|(?:a|per|in\\s+a|each|every)\\s+(?:day|week)|daily|weekly";
  const expression = new RegExp(
    `\\b(?:at\\s*most|maximum|max|no\\s+more\\s+than|not\\s+more\\s+than|up\\s+to|less\\s+than|under)\\s+(${numberPattern})\\s*(?:${targetUnit})\\s*(?:${period})\\b`,
  );
  return expression.test(text);
}

function hasUnsupportedExactQuota(text: string) {
  const numberPattern = `\\d+|${Object.keys(NUMBER_WORDS).join("|")}`;
  const targetUnit = "x|times?|days?|sessions?|glasses?";
  const period = "\\/\\s*(?:day|week)|(?:a|per|in\\s+a|each|every)\\s+(?:day|week)|daily|weekly";
  const expression = new RegExp(
    `\\b(?:exactly|only|just|precisely)\\s+(${numberPattern})\\s*(?:${targetUnit})\\s*(?:${period})\\b`,
  );
  return expression.test(text);
}

function parseLooseWeeklyQuota(text: string) {
  const numberPattern = `\\d+|${Object.keys(NUMBER_WORDS).join("|")}`;
  const qualifier = "at\\s*least|atleast|minimum|min|at\\s+minimum";
  const targetUnit = "x|times?|sessions?";
  const patterns = [
    new RegExp(`\\b(?:${qualifier})\\s+(${numberPattern})\\s*(?:${targetUnit})\\b`),
    new RegExp(`\\b(${numberPattern})\\s*(?:${targetUnit})\\s*(?:${qualifier})\\b`),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const targetCount = parseNumberToken(match[1]);
    if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 31) return null;
    return {
      targetCount,
      comparator: "at_least" as const,
    };
  }

  const fuzzyTarget = /\b(like|about|around|roughly|maybe|target|goal)\b/.test(text);
  if (!fuzzyTarget) return null;
  const fuzzyMatch = new RegExp(`\\b(${numberPattern})\\s*(?:${targetUnit})\\b`).exec(text);
  if (!fuzzyMatch) return null;
  const targetCount = parseNumberToken(fuzzyMatch[1]);
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 31) return null;
  return {
    targetCount,
    comparator: "at_least" as const,
  };
}

function formatDateForSummary(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

function formatWeekdayList(weekdays: number[]) {
  const labels = weekdays.map(getWeekdayLabel);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function summarizeRecurrenceSchedule(schedule: RecurrenceAssistantSchedule | null | undefined) {
  if (!schedule || schedule.mode === "none") return "No repeat";

  let cadence: string;
  if (schedule.mode === "daily") {
    if (schedule.interval === 2) {
      cadence = "Every other day";
    } else {
      cadence = schedule.interval && schedule.interval > 1 ? `Every ${schedule.interval} days` : "Every day";
    }
  } else if (schedule.mode === "daily_quota") {
    const count = schedule.targetCount === 1 ? "once" : `${schedule.targetCount} times`;
    cadence = schedule.comparator === "at_least"
      ? `At least ${count} per day`
      : `${count} per day`;
  } else if (schedule.mode === "weekdays") {
    cadence = "Every weekday";
  } else if (schedule.mode === "weekly") {
    const weekdays = schedule.weekdays ?? [getUtcWeekday(schedule.startDate)];
    if (schedule.interval === 2 && weekdays.length === 1) {
      cadence = `Every other ${formatWeekdayList(weekdays)}`;
    } else {
      const interval = schedule.interval && schedule.interval > 1 ? `Every ${schedule.interval} weeks` : "Every week";
      cadence = `${interval} on ${formatWeekdayList(weekdays)}`;
    }
  } else {
    const count = schedule.targetCount === 1 ? "once" : `${schedule.targetCount} times`;
    cadence = schedule.comparator === "at_least"
      ? `At least ${count} per week`
      : `${count} per week`;
  }

  const end = schedule.endDate ? ` until ${formatDateForSummary(schedule.endDate)}` : "";
  return `${cadence} starting ${formatDateForSummary(schedule.startDate)}${end}`;
}

function occursOnDate(schedule: RecurrenceAssistantSchedule, dateKey: string) {
  if (schedule.mode === "none") return false;
  if (schedule.mode === "daily_quota") return false;
  if (schedule.mode === "weekly_quota") return false;
  if (dateKey < schedule.startDate) return false;
  if (schedule.endDate && dateKey > schedule.endDate) return false;

  if (schedule.mode === "daily") {
    return diffDays(schedule.startDate, dateKey) % (schedule.interval ?? 1) === 0;
  }

  if (schedule.mode === "weekdays") {
    const weekday = getUtcWeekday(dateKey);
    return weekday >= 1 && weekday <= 5;
  }

  const daysSinceStart = diffDays(schedule.startDate, dateKey);
  const weeksSinceStart = Math.floor(daysSinceStart / 7);
  return (
    weeksSinceStart % (schedule.interval ?? 1) === 0 &&
    (schedule.weekdays ?? [getUtcWeekday(schedule.startDate)]).includes(getUtcWeekday(dateKey))
  );
}

export function getRecurrencePreviewDates(schedule: RecurrenceAssistantSchedule, count = 6) {
  if (schedule.mode === "none") return [];
  if (schedule.mode === "daily_quota") return [];
  if (schedule.mode === "weekly_quota") return [];

  const dates: string[] = [];
  let cursor = schedule.startDate;
  let guard = 0;

  while (dates.length < count && guard < 730) {
    if (schedule.endDate && cursor > schedule.endDate) break;
    if (occursOnDate(schedule, cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }

  return dates;
}

export function createRecurrenceAssistantResultFromSchedule(
  schedule: RecurrenceAssistantSchedule,
  options: { previewCount?: number } = {},
): RecurrenceAssistantResult {
  if (schedule.mode === "none") {
    return {
      ok: true,
      draft: {
        recurrence: { mode: "none" },
        summary: "This will stop repeating.",
        previewDates: [],
      },
    };
  }

  const startDate = normalizeDateInput(schedule.startDate);
  const hasEndDateInput = schedule.endDate !== undefined && schedule.endDate !== null;
  const endDate = normalizeDateInput(schedule.endDate);
  if (!startDate) return reject("The repeat start date is invalid.");
  if (hasEndDateInput && !endDate) return reject("The repeat end date is invalid.");
  if (endDate && endDate < startDate) return reject("The end date is before the start date.");

  let recurrence: RecurrenceAssistantSchedule;
  if (schedule.mode === "daily") {
    const interval = schedule.interval ?? 1;
    if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
      return reject("The daily repeat interval is invalid.");
    }
    recurrence = { mode: "daily", startDate, endDate, interval };
  } else if (schedule.mode === "daily_quota") {
    if (!Number.isInteger(schedule.targetCount) || schedule.targetCount < 1 || schedule.targetCount > MAX_DAILY_QUOTA_TARGET) {
      return reject("The daily target count is invalid.");
    }
    recurrence = {
      mode: "daily_quota",
      startDate,
      endDate,
      targetCount: schedule.targetCount,
      comparator: schedule.comparator ?? "at_least",
    };
  } else if (schedule.mode === "weekdays") {
    recurrence = { mode: "weekdays", startDate, endDate };
  } else if (schedule.mode === "weekly") {
    const interval = schedule.interval ?? 1;
    const weekdays = schedule.weekdays ?? [getUtcWeekday(startDate)];
    const normalizedWeekdays = Array.from(new Set(weekdays)).sort((a, b) => a - b);
    const hasValidWeekdays = normalizedWeekdays.every((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6);
    if (!Number.isInteger(interval) || interval < 1 || interval > 52 || normalizedWeekdays.length === 0 || !hasValidWeekdays) {
      return reject("The weekly repeat pattern is invalid.");
    }
    recurrence = { mode: "weekly", startDate, endDate, interval, weekdays: normalizedWeekdays };
  } else {
    if (!Number.isInteger(schedule.targetCount) || schedule.targetCount < 1 || schedule.targetCount > 31) {
      return reject("The weekly target count is invalid.");
    }
    recurrence = {
      mode: "weekly_quota",
      startDate,
      endDate,
      targetCount: schedule.targetCount,
      comparator: schedule.comparator ?? "at_least",
    };
  }

  const previewDates = getRecurrencePreviewDates(recurrence, options.previewCount ?? 6);
  if (previewDates.length === 0 && recurrence.mode !== "daily_quota" && recurrence.mode !== "weekly_quota") {
    return reject("This repeat pattern does not create any upcoming dates.");
  }

  return {
    ok: true,
    draft: {
      recurrence,
      summary: summarizeRecurrenceSchedule(recurrence),
      previewDates,
    },
  };
}

function reject(message: string): RecurrenceAssistantResult {
  return { ok: false, message, suggestions: SUGGESTIONS };
}

export function parseRecurrencePrompt(prompt: string, options: ParseOptions = {}): RecurrenceAssistantResult {
  const text = normalizePrompt(prompt);
  if (!text) return reject("Type a repeat pattern first.");

  if (/\b(month|monthly|year|yearly|annual|annually|quarter|quarterly)\b/.test(text)) {
    return reject("Monthly and yearly repeats are not supported by the current recurrence engine yet.");
  }
  if (hasUnsupportedQuotaCeiling(text)) {
    return reject("Maximum-style repeat targets are not supported yet. Use an at-least target instead.");
  }
  if (hasUnsupportedExactQuota(text)) {
    return reject("Exact repeat targets are not supported yet. Use an at-least target instead.");
  }

  const todayDate = normalizeDateInput(options.todayDate) ?? getLocalDateKey();
  const existingStartDate = options.existingSchedule && options.existingSchedule.mode !== "none"
    ? normalizeDateInput(options.existingSchedule.startDate)
    : null;
  const initialStartDate = normalizeDateInput(options.initialStartDate) ?? existingStartDate;
  if (/\b(no repeat|stop repeating|remove repeat|remove recurrence|never repeat|do not repeat|don't repeat|cancel repeat|turn off repeat)\b/.test(text)) {
    return {
      ok: true,
      draft: {
        recurrence: { mode: "none" },
        summary: "This will stop repeating.",
        previewDates: [],
      },
    };
  }

  const endDate = parseEndDate(text, todayDate);
  const explicitStartDate = parseStartDateAfterPrefix(text, todayDate);
  const startFallbackDate = existingStartDate ?? initialStartDate;
  let startDate = parseStartDate(text, todayDate, startFallbackDate, endDate);
  const dailyQuota = parseQuota(text, "day");
  const weeklyQuota = parseQuota(text, "week");
  const looseWeeklyQuota = parseLooseWeeklyQuota(text);
  const mentionedWeekdays = getMentionedWeekdays(text);
  const intervalDays = getInterval(text, "day") ?? getEveryOtherInterval(text, "day", mentionedWeekdays.length > 0);
  const intervalWeeks = getInterval(text, "week") ?? getEveryOtherInterval(text, "week", mentionedWeekdays.length > 0);
  const hasWeekdayRangePhrase = /\b(monday through friday|mon through fri|mon-fri)\b/.test(text);
  const hasWeekdaysKeyword = /\b(weekdays|weekday|workdays|work days|business days|monday through friday|mon through fri|mon-fri)\b/.test(text);
  const hasDaily = /\b(daily|every day|each day)\b/.test(text) || intervalDays !== null;
  const hasWeekly = /\b(weekly|every week|each week)\b/.test(text) || intervalWeeks !== null || mentionedWeekdays.length > 0;
  const hasStartInstruction = /\b(starting|starts|start|from|beginning|begins|begin)\b/.test(text);
  const hasEndInstruction = /\b(until|ending|ends|end|stopping|stop)\b/.test(text) || (!hasWeekdayRangePhrase && /\bthrough\b/.test(text));
  if (hasStartInstruction && hasStartDateCandidate(text) && !explicitStartDate) {
    return reject("The repeat start date is invalid.");
  }
  if (hasEndInstruction && !endDate) {
    return reject("The repeat end date is invalid.");
  }
  const existingEndDate = options.existingSchedule && options.existingSchedule.mode !== "none"
    ? options.existingSchedule.endDate ?? null
    : null;
  const nextEndDate = hasEndInstruction ? endDate : existingEndDate;

  if (endDate && endDate < startDate) {
    return reject("The end date is before the start date.");
  }

  let recurrence: RecurrenceAssistantSchedule | null = null;

  if (dailyQuota) {
    recurrence = {
      mode: "daily_quota",
      startDate,
      endDate: nextEndDate,
      targetCount: dailyQuota.targetCount,
      comparator: dailyQuota.comparator ?? "at_least",
    };
  } else if (weeklyQuota || looseWeeklyQuota) {
    const quota = weeklyQuota ?? looseWeeklyQuota;
    if (!quota) return reject("I could not find a weekly target count.");
    recurrence = {
      mode: "weekly_quota",
      startDate,
      endDate: nextEndDate,
      targetCount: quota.targetCount,
      comparator: quota.comparator ?? "at_least",
    };
  } else if (hasWeekdaysKeyword) {
    recurrence = { mode: "weekdays", startDate, endDate: nextEndDate };
  } else if (hasDaily) {
    recurrence = { mode: "daily", startDate, endDate: nextEndDate, interval: intervalDays ?? 1 };
  } else if (mentionedWeekdays.length > 0) {
    startDate = explicitStartDate ?? getNextMatchingWeekdayDate(startDate, mentionedWeekdays);
    if (nextEndDate && nextEndDate < startDate) return reject("The end date is before the first matching day.");
    const existingWeeklyInterval = options.existingSchedule?.mode === "weekly"
      ? options.existingSchedule.interval
      : null;
    recurrence = {
      mode: "weekly",
      startDate,
      endDate: nextEndDate,
      interval: intervalWeeks ?? existingWeeklyInterval ?? 1,
      weekdays: mentionedWeekdays,
    };
  } else if (hasWeekly) {
    recurrence = {
      mode: "weekly",
      startDate,
      endDate: nextEndDate,
      interval: intervalWeeks ?? 1,
      weekdays: [getUtcWeekday(startDate)],
    };
  }

  if (!recurrence && options.existingSchedule && options.existingSchedule.mode !== "none" && (hasStartInstruction || hasEndInstruction)) {
    recurrence = {
      ...options.existingSchedule,
      startDate,
      endDate: hasEndInstruction ? endDate : options.existingSchedule.endDate,
    };
  }

  if (!recurrence) {
    return reject("I could not find a daily, weekday, or weekly repeat pattern.");
  }

  return createRecurrenceAssistantResultFromSchedule(recurrence, {
    previewCount: options.previewCount,
  });
}

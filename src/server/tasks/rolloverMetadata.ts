export type TaskRolloverHistoryEntry = {
  from: string;
  to: string;
  at: string;
};

export function dateKeyToDueDate(dateKey: string) {
  return `${dateKey}T00:00:00.000Z`;
}

export function dueDateToDateKey(dueDate: string | null | undefined) {
  if (!dueDate) return null;
  const match = dueDate.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function parseRolloverHistory(value: string | null | undefined): TaskRolloverHistoryEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as TaskRolloverHistoryEntry).from === "string" &&
        typeof (entry as TaskRolloverHistoryEntry).to === "string" &&
        typeof (entry as TaskRolloverHistoryEntry).at === "string"
      ) {
        return [entry as TaskRolloverHistoryEntry];
      }
      return [];
    });
  } catch {
    return [];
  }
}

export function appendRolloverHistory(input: {
  existingHistory: string | null | undefined;
  fromDate: string | null;
  toDate: string;
  at: string;
}) {
  const history = parseRolloverHistory(input.existingHistory);
  if (!input.fromDate || input.fromDate === input.toDate) return JSON.stringify(history);

  const last = history.at(-1);
  if (last?.from === input.fromDate && last.to === input.toDate) {
    return JSON.stringify(history);
  }

  return JSON.stringify([...history, { from: input.fromDate, to: input.toDate, at: input.at }]);
}

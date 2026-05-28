import type { Task } from "../db/schema/tasks";
import { generateKeyBetween } from "fractional-indexing";

const INITIAL_POSITION = generateKeyBetween(null, null);

export function calculateNewTaskPosition(siblings: Task[]): string {
  if (siblings.length === 0) return INITIAL_POSITION;
  const lastSibling = siblings[siblings.length - 1];
  return generateKeyBetween(lastSibling.position || null, null);
}

// positionUtils.ts - Frontend position utilities matching backend logic

import { generateKeyBetween } from 'fractional-indexing';

export const INITIAL_POSITION = generateKeyBetween(null, null); // 'a0'

export const createPositionAfter = (lastPosition: string | null): string => {
  return generateKeyBetween(lastPosition, null);
};

export const createPositionBetween = (a: string | null, b: string | null): string => {
  return generateKeyBetween(a, b);
};

export const createPositionBefore = (position: string): string => {
  return generateKeyBetween(null, position);
};

export const generatePosition = (siblings: Array<{ position?: string }>): string => {
  if (siblings.length === 0) return INITIAL_POSITION;
  
  const lastSibling = siblings[siblings.length - 1];
  return createPositionAfter(lastSibling.position || null);
};

/**
 * Calculate position for inserting an item at a specific index
 */
export const calculatePositionAtIndex = (
  siblings: Array<{ position?: string }>,
  index: number
): string => {
  // Insert at beginning
  if (index === 0) {
    if (siblings.length === 0) return INITIAL_POSITION;
    const firstPosition = siblings[0].position || INITIAL_POSITION;
    return createPositionBefore(firstPosition);
  }
  
  // Insert at end
  if (index >= siblings.length) {
    return generatePosition(siblings);
  }
  
  // Insert between two items
  const prevPosition = siblings[index - 1]?.position || null;
  const nextPosition = siblings[index]?.position || null;
  return createPositionBetween(prevPosition, nextPosition);
};
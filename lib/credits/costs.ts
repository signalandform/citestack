/**
 * Credit cost for enrich: full = 3, tags_only = 1.
 */
export function getCreditCostEnrich(mode?: string): number {
  return mode === 'tags_only' ? 1 : 3;
}

/**
 * Credit cost for compare: 5 + 1 per item beyond 2 (2 items = 5, 5 items = 8).
 */
export function getCreditCostCompare(itemCount: number): number {
  if (itemCount < 2 || itemCount > 5) return 0;
  return 5 + Math.max(0, itemCount - 2);
}

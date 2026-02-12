/**
 * Coverage heuristic for items.
 * Good: strong text + enough quotes + abstract/bullets
 * Partial: medium coverage
 * Weak: sparse or missing data
 */
export type CoverageLevel = 'Good' | 'Partial' | 'Weak';

export type ItemForCoverage = {
  cleaned_text?: string | null;
  cleaned_text_length?: number | null;
  abstract?: string | null;
  bullets?: unknown[] | null;
  quotes?: unknown[] | { length: number } | null;
  quotes_count?: number;
  status?: string;
};

export function computeCoverage(item: ItemForCoverage): CoverageLevel | null {
  if (item.status !== 'enriched') return null;

  const textLen =
    item.cleaned_text_length ??
    (item.cleaned_text ?? '').length;
  let quoteCount: number;
  if (item.quotes_count != null) {
    quoteCount = item.quotes_count;
  } else if (Array.isArray(item.quotes)) {
    quoteCount = item.quotes.length;
  } else {
    const q = item.quotes as { length?: number } | null | undefined;
    quoteCount = (q && typeof q.length === 'number') ? q.length : 0;
  }
  const hasAbstract = !!(item.abstract?.trim());
  const hasBullets = Array.isArray(item.bullets) && item.bullets.length > 0;

  const textStrong = textLen > 2000;
  const textWeak = textLen < 500;

  const quotesStrong = quoteCount >= 5;
  const quotesWeak = quoteCount < 2;

  const hasAbstractAndBullets = hasAbstract && hasBullets;

  if (textStrong && quotesStrong && hasAbstractAndBullets) return 'Good';
  if (textWeak || (quotesWeak && !hasAbstractAndBullets)) return 'Weak';
  return 'Partial';
}

export function getCoverageExplanation(level: CoverageLevel): string {
  switch (level) {
    case 'Good':
      return 'Strong coverage: substantial text, 5+ quotes, and abstract with bullets.';
    case 'Partial':
      return 'Partial coverage: some extraction or enrichment gaps (e.g. fewer quotes or shorter text).';
    case 'Weak':
      return 'Weak coverage: limited text, few or no quotes, or missing abstract/bullets.';
    default:
      return '';
  }
}

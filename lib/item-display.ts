/**
 * Centralized display logic for item titles.
 * Fallback chain: title -> domain (URL) -> original_filename (file) -> id prefix
 */
export type ItemForDisplay = {
  id: string;
  title?: string | null;
  source_type: string;
  domain?: string | null;
  original_filename?: string | null;
};

export function getItemDisplayTitle(item: ItemForDisplay): string {
  const t = item.title?.trim();
  if (t) return t;
  if (item.source_type === 'url' && item.domain) return item.domain;
  if (item.source_type === 'file' && item.original_filename) return item.original_filename;
  return item.id.slice(0, 8) + '…';
}

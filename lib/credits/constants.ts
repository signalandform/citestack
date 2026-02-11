export const DEFAULT_MONTHLY_GRANT = 100;
/** Free tier monthly grant (Billing & Usage). */
export const DEFAULT_MONTHLY_GRANT_FREE = 50;

export const REASON = {
  ENRICH_FULL: 'enrich_item_full',
  ENRICH_TAGS_ONLY: 'enrich_item_tags_only',
  COMPARE_ITEMS: 'compare_items',
  MONTHLY_GRANT: 'monthly_grant',
  ADMIN_GRANT: 'admin_grant',
  CREDIT_PACK: 'credit_pack',
} as const;

export type CreditReason = (typeof REASON)[keyof typeof REASON];

import { DEFAULT_MONTHLY_GRANT_FREE } from '@/lib/credits/constants';

export type PlanSlug = 'free' | 'pro' | 'power';

export const PLAN_MONTHLY_GRANT: Record<PlanSlug, number> = {
  free: DEFAULT_MONTHLY_GRANT_FREE,
  pro: 200,
  power: 500,
};

const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO ?? '';
const STRIPE_PRICE_ID_POWER = process.env.STRIPE_PRICE_ID_POWER ?? '';
const STRIPE_PRICE_ID_PACK_5 = process.env.STRIPE_PRICE_ID_PACK_5 ?? '';
const STRIPE_PRICE_ID_PACK_9 = process.env.STRIPE_PRICE_ID_PACK_9 ?? '';
const STRIPE_PRICE_ID_PACK_19 = process.env.STRIPE_PRICE_ID_PACK_19 ?? '';

/** Credit pack: price ID -> credits ($5->120, $9->250, $19->700). */
const PACK_PRICE_TO_CREDITS: Record<string, number> = {};
if (STRIPE_PRICE_ID_PACK_5) PACK_PRICE_TO_CREDITS[STRIPE_PRICE_ID_PACK_5] = 120;
if (STRIPE_PRICE_ID_PACK_9) PACK_PRICE_TO_CREDITS[STRIPE_PRICE_ID_PACK_9] = 250;
if (STRIPE_PRICE_ID_PACK_19) PACK_PRICE_TO_CREDITS[STRIPE_PRICE_ID_PACK_19] = 700;

export type CreditPackSlug = '5' | '9' | '19';

/** Map Stripe Price ID to plan and monthly_grant. Empty price IDs are skipped (app runs without Stripe). */
export function getPlanFromPriceId(priceId: string): { plan: PlanSlug; monthlyGrant: number } | null {
  if (!priceId) return null;
  if (priceId === STRIPE_PRICE_ID_PRO) return { plan: 'pro', monthlyGrant: PLAN_MONTHLY_GRANT.pro };
  if (priceId === STRIPE_PRICE_ID_POWER) return { plan: 'power', monthlyGrant: PLAN_MONTHLY_GRANT.power };
  return null;
}

/** Get Stripe Price ID for a plan. Returns empty string if not configured. */
export function getPriceIdForPlan(plan: 'pro' | 'power'): string {
  if (plan === 'pro') return STRIPE_PRICE_ID_PRO;
  if (plan === 'power') return STRIPE_PRICE_ID_POWER;
  return '';
}

/** Get credits for a credit-pack price ID. Returns 120, 250, or 700, else null. */
export function getCreditsForPackPriceId(priceId: string): number | null {
  if (!priceId) return null;
  const credits = PACK_PRICE_TO_CREDITS[priceId];
  return credits ?? null;
}

/** Get Stripe Price ID for a credit pack. Returns empty string if not configured. */
export function getPriceIdForCreditPack(pack: CreditPackSlug): string {
  if (pack === '5') return STRIPE_PRICE_ID_PACK_5;
  if (pack === '9') return STRIPE_PRICE_ID_PACK_9;
  if (pack === '19') return STRIPE_PRICE_ID_PACK_19;
  return '';
}

/** Whether Stripe is configured (secret key and at least one price: subscription or pack). */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    (STRIPE_PRICE_ID_PRO ||
      STRIPE_PRICE_ID_POWER ||
      STRIPE_PRICE_ID_PACK_5 ||
      STRIPE_PRICE_ID_PACK_9 ||
      STRIPE_PRICE_ID_PACK_19)
  );
}

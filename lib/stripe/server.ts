import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureUserCredits } from '@/lib/credits/ensure';

let stripeInstance: Stripe | null = null;

/**
 * Server Stripe client. Throws if STRIPE_SECRET_KEY is not set.
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Missing STRIPE_SECRET_KEY');
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

/**
 * Get or create Stripe customer for the user and persist stripe_customer_id on user_credits.
 * Caller must have ensured user_credits row exists (e.g. ensureUserCredits) before calling.
 */
export async function getOrCreateStripeCustomer(
  admin: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<string> {
  const { data: row } = await admin
    .from('user_credits')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (row?.stripe_customer_id) return row.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    metadata: { user_id: userId },
    ...(email && { email: email.trim() }),
  });

  await admin
    .from('user_credits')
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  return customer.id;
}

import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureUserCredits } from '@/lib/credits/ensure';
import { getStripe, getOrCreateStripeCustomer } from '@/lib/stripe/server';
import {
  getPriceIdForPlan,
  getPriceIdForCreditPack,
  isStripeConfigured,
} from '@/lib/stripe/config';
import type { CreditPackSlug } from '@/lib/stripe/config';

export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Billing is not configured' },
      { status: 503 }
    );
  }

  let body: { plan?: string; priceId?: string; type?: string; pack?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const isCreditPack =
    body.type === 'credit_pack' &&
    (body.pack === '5' || body.pack === '9' || body.pack === '19');
  const pack = isCreditPack ? (body.pack as CreditPackSlug) : null;

  let priceId: string;
  let mode: 'subscription' | 'payment';

  if (pack) {
    priceId = getPriceIdForCreditPack(pack);
    mode = 'payment';
    if (!priceId) {
      return NextResponse.json(
        { error: `Price not configured for credit pack: $${pack}` },
        { status: 400 }
      );
    }
  } else {
    const planParam = (body.plan ?? body.priceId ?? '').trim().toLowerCase();
    const plan = planParam === 'power' ? 'power' : planParam === 'pro' ? 'pro' : null;
    if (!plan) {
      return NextResponse.json(
        { error: 'Missing plan or pack. Use { "plan": "pro"|"power" } or { "type": "credit_pack", "pack": "5"|"9"|"19" }' },
        { status: 400 }
      );
    }
    priceId = getPriceIdForPlan(plan);
    mode = 'subscription';
    if (!priceId) {
      return NextResponse.json(
        { error: `Price not configured for plan: ${plan}` },
        { status: 400 }
      );
    }
  }

  try {
    const admin = supabaseAdmin();
    await ensureUserCredits(admin, user.id);
    const customerId = await getOrCreateStripeCustomer(
      admin,
      user.id,
      user.email ?? undefined
    );

    const baseUrl = new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode,
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/account?checkout=success`,
      cancel_url: `${baseUrl}/account?checkout=canceled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Could not create checkout session' },
        { status: 500 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe/checkout]', err);
    return NextResponse.json(
      { error: 'Could not create checkout session', details: message },
      { status: 500 }
    );
  }
}

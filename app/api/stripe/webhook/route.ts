import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { logError } from '@/lib/logger';
import { getStripe } from '@/lib/stripe/server';
import {
  getPlanFromPriceId,
  getCreditsForPackPriceId,
  PLAN_MONTHLY_GRANT,
} from '@/lib/stripe/config';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureUserCredits } from '@/lib/credits/ensure';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

async function syncSubscriptionToUser(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const status = subscription.status ?? '';
  const priceId =
    subscription.items?.data?.[0]?.price?.id ??
    (subscription.items?.data?.[0]?.price as Stripe.Price)?.id;
  const planInfo = priceId ? getPlanFromPriceId(priceId) : null;

  const updates: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    stripe_subscription_status: status,
    updated_at: new Date().toISOString(),
  };
  if (planInfo && (status === 'active' || status === 'trialing')) {
    updates.plan = planInfo.plan;
    updates.monthly_grant = planInfo.monthlyGrant;
  } else {
    updates.plan = 'free';
    updates.monthly_grant = PLAN_MONTHLY_GRANT.free;
  }

  await admin.from('user_credits').update(updates).eq('user_id', userId);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logError('stripe/webhook', new Error('Missing STRIPE_WEBHOOK_SECRET'));
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let payload: string;
  try {
    payload = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    logError('stripe/webhook', err, { context: 'Signature verification failed' });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: existing } = await admin
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = (session.client_reference_id ?? '').trim();
        if (!userId) {
          logError('stripe/webhook', new Error('checkout.session.completed missing client_reference_id'));
          break;
        }
        if (session.mode === 'subscription' && session.subscription) {
          await ensureUserCredits(admin, userId);
          if (session.customer && typeof session.customer === 'string') {
            await admin
              .from('user_credits')
              .update({
                stripe_customer_id: session.customer,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
          }
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
            { expand: ['items.data.price'] }
          );
          await syncSubscriptionToUser(admin, userId, subscription);
        } else if (session.mode === 'payment') {
          const stripe = getStripe();
          const sessionWithLines = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items.data.price'],
          });
          const priceId =
            sessionWithLines.line_items?.data?.[0]?.price?.id ??
            (sessionWithLines.line_items?.data?.[0]?.price as Stripe.Price)?.id;
          const credits = priceId ? getCreditsForPackPriceId(priceId) : null;
          if (credits == null) {
            logError('stripe/webhook', new Error('credit pack unknown price id'), { priceId });
            break;
          }
          await ensureUserCredits(admin, userId);
          if (session.customer && typeof session.customer === 'string') {
            await admin
              .from('user_credits')
              .update({
                stripe_customer_id: session.customer,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
          }
          const { error } = await admin.rpc('grant_credits_pack', {
            p_user_id: userId,
            p_amount: credits,
          });
          if (error) {
            logError('stripe/webhook', new Error(error.message), { context: 'grant_credits_pack failed' });
            throw new Error(error.message);
          }
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;
        if (!customerId) break;
        const { data: row } = await admin
          .from('user_credits')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();
        if (!row?.user_id) break;
        await syncSubscriptionToUser(admin, row.user_id, subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;
        if (!customerId) break;
        await admin
          .from('user_credits')
          .update({
            plan: 'free',
            monthly_grant: PLAN_MONTHLY_GRANT.free,
            stripe_subscription_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);
        break;
      }
      default:
        break;
    }

    await admin.from('stripe_webhook_events').insert({
      event_id: event.id,
      processed_at: new Date().toISOString(),
    });
  } catch (err) {
    logError('stripe/webhook', err, { eventType: event.type });
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

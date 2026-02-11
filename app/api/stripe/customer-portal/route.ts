import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe/server';

export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = supabaseAdmin();
    const { data: row } = await admin
      .from('user_credits')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!row?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing customer found. Subscribe first.' },
        { status: 400 }
      );
    }

    const baseUrl = new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${baseUrl}/account`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Could not create portal session' },
        { status: 500 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe/customer-portal]', err);
    return NextResponse.json(
      { error: 'Could not open billing portal', details: message },
      { status: 500 }
    );
  }
}

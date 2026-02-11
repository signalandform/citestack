import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('user_settings')
    .select('has_completed_onboarding, marketing_emails')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Could not load settings' }, { status: 500 });
  }

  const hasCompleted = data?.has_completed_onboarding ?? false;
  let marketingEmails = data?.marketing_emails ?? false;

  if (data == null && user.user_metadata?.marketing_emails === true) {
    marketingEmails = true;
    await admin.from('user_settings').upsert(
      {
        user_id: user.id,
        has_completed_onboarding: false,
        marketing_emails: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  }

  return NextResponse.json({
    has_completed_onboarding: hasCompleted,
    marketing_emails: marketingEmails,
  });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { has_completed_onboarding?: boolean; marketing_emails?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const hasCompleted =
    typeof body.has_completed_onboarding === 'boolean' ? body.has_completed_onboarding : undefined;
  const marketingEmails =
    typeof body.marketing_emails === 'boolean' ? body.marketing_emails : undefined;

  if (hasCompleted === undefined && marketingEmails === undefined) {
    return NextResponse.json(
      { error: 'Provide at least one of has_completed_onboarding or marketing_emails' },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();
  const payload: {
    user_id: string;
    has_completed_onboarding?: boolean;
    marketing_emails?: boolean;
    updated_at: string;
  } = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (hasCompleted !== undefined || marketingEmails !== undefined) {
    const { data: existing } = await admin
      .from('user_settings')
      .select('has_completed_onboarding, marketing_emails')
      .eq('user_id', user.id)
      .maybeSingle();

    payload.has_completed_onboarding =
      hasCompleted !== undefined ? hasCompleted : (existing?.has_completed_onboarding ?? false);
    payload.marketing_emails =
      marketingEmails !== undefined ? marketingEmails : (existing?.marketing_emails ?? false);
  }

  const { error } = await admin.from('user_settings').upsert(payload, { onConflict: 'user_id' });

  if (error) {
    return NextResponse.json({ error: 'Could not update settings' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

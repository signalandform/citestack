import { NextResponse } from 'next/server';
import { getAdminSecret } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const secret = getAdminSecret(request);
  const expected = process.env.CITESTACK_ADMIN_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { userId?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const amount = typeof body.amount === 'number' ? Math.floor(body.amount) : 0;

  if (!userId || amount <= 0) {
    return NextResponse.json(
      { error: 'userId (string) and amount (positive number) are required' },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();
  const { error } = await admin.rpc('grant_credits_admin', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? 'Could not grant credits' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, granted: amount });
}

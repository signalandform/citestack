import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getBalance } from '@/lib/credits';

export async function GET() {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const balanceResult = await getBalance(admin, user.id);

  const { data: ledger } = await admin
    .from('credit_ledger')
    .select('id, delta, reason, job_id, item_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({
    balance: balanceResult.balance,
    resetAt: balanceResult.resetAt,
    monthlyGrant: balanceResult.monthlyGrant,
    ledger: ledger ?? [],
  });
}

import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enqueueEnrichItem } from '@/lib/jobs/enqueue-enrich';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: itemId } = await params;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode'); // concise | analytical | null

  const admin = supabaseAdmin();
  const { data: item, error: itemErr } = await admin
    .from('items')
    .select('id, user_id')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .single();

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  await admin.from('items').update({ error: null }).eq('id', itemId);

  const result = await enqueueEnrichItem(admin, user.id, itemId, true, mode || undefined);
  if ('error' in result && result.error === 'insufficient_credits') {
    return NextResponse.json(
      {
        error: 'Insufficient credits',
        message: `Need ${result.required} credits; you have ${result.balance}. Credits reset monthly.`,
        required: result.required,
        balance: result.balance,
      },
      { status: 402 }
    );
  }
  if ('jobId' in result) {
    return NextResponse.json({ message: 'Re-enrich enqueued', jobId: result.jobId }, { status: 200 });
  }
  return NextResponse.json({ message: 'Skipped (already queued or running)', skipped: true }, { status: 200 });
}

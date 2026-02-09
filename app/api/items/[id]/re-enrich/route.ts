import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enqueueEnrichItem } from '@/lib/jobs/enqueue-enrich';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: itemId } = await params;

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

  const { jobId } = await enqueueEnrichItem(admin, user.id, itemId, true);
  return NextResponse.json({ message: 'Re-enrich enqueued', jobId }, { status: 200 });
}

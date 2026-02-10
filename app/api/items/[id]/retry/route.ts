import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enqueueEnrichItem } from '@/lib/jobs/enqueue-enrich';

async function hasJob(
  admin: ReturnType<typeof supabaseAdmin>,
  itemId: string,
  type: string
): Promise<boolean> {
  const { data } = await admin
    .from('jobs')
    .select('id')
    .eq('item_id', itemId)
    .eq('type', type)
    .in('status', ['queued', 'running'])
    .limit(1)
    .maybeSingle();
  return !!data?.id;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: itemId } = await params;
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';

  const admin = supabaseAdmin();
  const { data: item, error: itemErr } = await admin
    .from('items')
    .select('id, user_id, source_type, url, file_path, mime_type')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .single();

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  await admin.from('items').update({ error: null }).eq('id', itemId);

  if (item.source_type === 'url') {
    if (!item.url) {
      return NextResponse.json({ error: 'Item has no URL' }, { status: 400 });
    }
    const exists = await hasJob(admin, itemId, 'extract_url');
    if (exists && !force) {
      return NextResponse.json({ message: 'Extract job already queued or running', jobId: null }, { status: 200 });
    }
    const { data: job, error } = await admin
      .from('jobs')
      .insert({
        user_id: user.id,
        item_id: itemId,
        type: 'extract_url',
        payload: { itemId, url: item.url },
        status: 'queued',
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: 'Could not enqueue job' }, { status: 500 });
    return NextResponse.json({ message: 'Retry enqueued', jobId: job?.id }, { status: 200 });
  }

  if (item.source_type === 'file') {
    if (!item.file_path || !item.mime_type) {
      return NextResponse.json({ error: 'Item has no file path' }, { status: 400 });
    }
    const exists = await hasJob(admin, itemId, 'extract_file');
    if (exists && !force) {
      return NextResponse.json({ message: 'Extract job already queued or running', jobId: null }, { status: 200 });
    }
    const { data: job, error } = await admin
      .from('jobs')
      .insert({
        user_id: user.id,
        item_id: itemId,
        type: 'extract_file',
        payload: { itemId, filePath: item.file_path, mimeType: item.mime_type },
        status: 'queued',
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: 'Could not enqueue job' }, { status: 500 });
    return NextResponse.json({ message: 'Retry enqueued', jobId: job?.id }, { status: 200 });
  }

  if (item.source_type === 'paste') {
    const result = await enqueueEnrichItem(admin, user.id, itemId, force);
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
    if ('skipped' in result && result.skipped) {
      return NextResponse.json({ message: 'Enrich job already queued or running', jobId: null }, { status: 200 });
    }
    const jobId = 'jobId' in result ? result.jobId : undefined;
    return NextResponse.json({ message: 'Retry enqueued', jobId }, { status: 200 });
  }

  return NextResponse.json({ error: 'Unknown source type' }, { status: 400 });
}

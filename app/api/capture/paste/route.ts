import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getCachedResponse,
  storeResponse,
  sanitizeIdempotencyKey,
} from '@/lib/idempotency';
import { enqueueEnrichItem } from '@/lib/jobs/enqueue-enrich';

function pasteIdempotencyKey(userId: string, text: string, title?: string): string {
  const input = `${userId}:${text}:${title ?? ''}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 256);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { title?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text : '';
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title.trim() : undefined;

  const admin = supabaseAdmin();
  const idempotencyKey =
    sanitizeIdempotencyKey(request.headers.get('idempotency-key')) ??
    pasteIdempotencyKey(user.id, text, title);

  const cached = await getCachedResponse(admin, user.id, idempotencyKey);
  if (cached) {
    return NextResponse.json(cached.body, { status: cached.status });
  }

  const { data: item, error: itemError } = await admin
    .from('items')
    .insert({
      user_id: user.id,
      source_type: 'paste',
      title: title || null,
      raw_text: text,
      cleaned_text: text,
      status: 'captured',
    })
    .select('id')
    .single();

  if (itemError || !item) {
    const message = itemError?.message ?? 'Unknown error';
    logError('capture/paste', itemError, { userId: user.id, context: 'items insert failed' });
    return NextResponse.json(
      { error: 'Could not create item', details: message },
      { status: 500 }
    );
  }

  try {
    const result = await enqueueEnrichItem(admin, user.id, item.id);
    if ('error' in result && result.error === 'insufficient_credits') {
      const responseBody = {
        error: 'Insufficient credits',
        message: `Need ${result.required} credits; you have ${result.balance}. Credits reset monthly.`,
        required: result.required,
        balance: result.balance,
      };
      await storeResponse(admin, user.id, idempotencyKey, 402, responseBody);
      return NextResponse.json(responseBody, { status: 402 });
    }
    const jobId = 'jobId' in result ? result.jobId : undefined;
    const responseBody = { itemId: item.id, jobId };
    await storeResponse(admin, user.id, idempotencyKey, 201, responseBody);
    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('capture/paste', err, { itemId: item.id, context: 'enqueue failed' });
    return NextResponse.json(
      { error: 'Could not enqueue job', details: message },
      { status: 500 }
    );
  }
}

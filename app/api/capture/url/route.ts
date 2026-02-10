import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { canonicalizeUrl } from '@/lib/url';
import {
  getCachedResponse,
  storeResponse,
  sanitizeIdempotencyKey,
} from '@/lib/idempotency';

export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const idempotencyKey = sanitizeIdempotencyKey(request.headers.get('idempotency-key'));
  const admin = supabaseAdmin();

  if (idempotencyKey) {
    const cached = await getCachedResponse(admin, user.id, idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  let body: { url?: string; collectionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const canonical = canonicalizeUrl(url);
  if (!canonical) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const collectionId =
    typeof body.collectionId === 'string' ? body.collectionId.trim() : undefined;

  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from('items')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('source_type', 'url')
    .eq('url_canonical', canonical)
    .maybeSingle();

  if (existing) {
    await admin
      .from('items')
      .update({ last_saved_at: now, updated_at: now })
      .eq('id', existing.id);

    if (collectionId) {
      const { data: coll } = await admin
        .from('collections')
        .select('id')
        .eq('id', collectionId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (coll?.id) {
        await admin.from('collection_items').upsert(
          { collection_id: collectionId, item_id: existing.id },
          { onConflict: 'collection_id,item_id' }
        );
      }
    }

    const responseBody = {
      itemId: existing.id,
      deduped: true,
      status: existing.status,
    };
    if (idempotencyKey) {
      await storeResponse(admin, user.id, idempotencyKey, 200, responseBody);
    }
    return NextResponse.json(responseBody, { status: 200 });
  }

  const { data: item, error: itemError } = await admin
    .from('items')
    .insert({
      user_id: user.id,
      source_type: 'url',
      url,
      url_canonical: canonical,
      status: 'captured',
      last_saved_at: now,
    })
    .select('id')
    .single();

  if (itemError || !item) {
    return NextResponse.json(
      { error: 'Could not create item' },
      { status: 500 }
    );
  }

  const { error: jobError } = await admin.from('jobs').insert({
    user_id: user.id,
    item_id: item.id,
    type: 'extract_url',
    payload: { itemId: item.id, url },
    status: 'queued',
  });

  if (jobError) {
    return NextResponse.json(
      { error: 'Could not enqueue job' },
      { status: 500 }
    );
  }

  if (collectionId) {
    const { data: coll } = await admin
      .from('collections')
      .select('id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (coll?.id) {
      await admin.from('collection_items').upsert(
        { collection_id: collectionId, item_id: item.id },
        { onConflict: 'collection_id,item_id' }
      );
    }
  }

  const responseBody = {
    itemId: item.id,
    deduped: false,
    status: 'captured',
  };
  if (idempotencyKey) {
    await storeResponse(admin, user.id, idempotencyKey, 201, responseBody);
  }
  return NextResponse.json(responseBody, { status: 201 });
}

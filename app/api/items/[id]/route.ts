import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const admin = supabaseAdmin();
  const { data: item, error } = await admin
    .from('items')
    .select('id, title, source_type, url, domain, status, raw_text, cleaned_text, original_filename, mime_type, abstract, bullets, summary, error, created_at, updated_at, extracted_at, enriched_at, thumbnail_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !item) {
    return NextResponse.json(
      { error: 'Item not found' },
      { status: 404 }
    );
  }

  const [{ data: quotes }, { data: tagRows }, { data: collectionRows }] = await Promise.all([
    admin.from('quotes').select('id, quote, why_it_matters').eq('item_id', id).eq('user_id', user.id),
    admin.from('item_tags').select('tag_id').eq('item_id', id),
    admin.from('collection_items').select('collection_id').eq('item_id', id),
  ]);

  const tagIds = (tagRows ?? []).map((r) => r.tag_id);
  const tagNames: string[] = [];
  if (tagIds.length > 0) {
    const { data: tags } = await admin.from('tags').select('name').eq('user_id', user.id).in('id', tagIds);
    tagNames.push(...((tags ?? []).map((t) => t.name) as string[]));
  }

  const collectionIds = (collectionRows ?? []).map((r) => r.collection_id);

  return NextResponse.json({
    ...item,
    quotes: quotes ?? [],
    tags: tagNames,
    collection_ids: collectionIds,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: { title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title =
    typeof body.title === 'string'
      ? body.title.trim().slice(0, 500) || null
      : undefined;

  if (title === undefined) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: item, error } = await admin
    .from('items')
    .update({
      title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, title')
    .single();

  if (error || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const admin = supabaseAdmin();
  const { data: item, error: fetchError } = await admin
    .from('items')
    .select('id, file_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !item) {
    return NextResponse.json(
      { error: 'Item not found' },
      { status: 404 }
    );
  }

  if (item.file_path) {
    await admin.storage.from('library-files').remove([item.file_path]);
  }

  const { error: deleteError } = await admin
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: 'Could not delete item' },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}

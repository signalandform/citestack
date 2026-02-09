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
    .select('id, title, source_type, url, domain, status, raw_text, cleaned_text, original_filename, summary, error, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !item) {
    return NextResponse.json(
      { error: 'Item not found' },
      { status: 404 }
    );
  }

  const [{ data: quotes }, { data: tagRows }] = await Promise.all([
    admin.from('quotes').select('id, quote, why_it_matters').eq('item_id', id).eq('user_id', user.id),
    admin.from('item_tags').select('tag_id').eq('item_id', id),
  ]);

  const tagIds = (tagRows ?? []).map((r) => r.tag_id);
  const tagNames: string[] = [];
  if (tagIds.length > 0) {
    const { data: tags } = await admin.from('tags').select('name').eq('user_id', user.id).in('id', tagIds);
    tagNames.push(...((tags ?? []).map((t) => t.name) as string[]));
  }

  return NextResponse.json({
    ...item,
    quotes: quotes ?? [],
    tags: tagNames,
  });
}

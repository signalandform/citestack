import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isBlockedUrl } from '@/lib/url/blocklist';

const FETCH_TIMEOUT_MS = 15000;

function extensionFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i);
    return match ? match[1].toLowerCase() : 'jpg';
  } catch {
    return 'jpg';
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const index = searchParams.get('index');

  if (!url?.trim()) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: item, error } = await admin
    .from('items')
    .select('id, user_id, image_urls')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const allowed = Array.isArray(item.image_urls) && item.image_urls.includes(url.trim());
  if (!allowed) {
    return NextResponse.json({ error: 'Image not found for this item' }, { status: 404 });
  }

  if (isBlockedUrl(url)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Citestack/1.0 (research library)' },
    });
    clearTimeout(timeout);
  } catch {
    return NextResponse.json({ error: 'Could not fetch image' }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'Image fetch failed' }, { status: 502 });
  }

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const ext = extensionFromUrl(url);
  const num = index != null && /^\d+$/.test(index) ? index : '1';
  const filename = `image-${num}.${ext}`;

  const blob = await res.arrayBuffer();
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

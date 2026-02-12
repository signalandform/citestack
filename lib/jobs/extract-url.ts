import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isBlockedUrl } from '@/lib/url/blocklist';
import { enqueueEnrichItem } from './enqueue-enrich';

const FETCH_TIMEOUT_MS = 15000;

async function setItemFailed(
  admin: SupabaseClient,
  itemId: string,
  msg: string
): Promise<void> {
  await admin
    .from('items')
    .update({
      status: 'failed',
      error: msg,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);
}

export async function runExtractUrl(
  admin: SupabaseClient,
  jobId: string,
  payload: { itemId: string; url: string }
): Promise<{ error?: string }> {
  const { itemId, url } = payload;
  if (!itemId || !url) return { error: 'Missing itemId or url' };

  const { data: item, error: itemErr } = await admin
    .from('items')
    .select('id, user_id')
    .eq('id', itemId)
    .single();

  if (itemErr || !item) return { error: 'Item not found' };

  if (isBlockedUrl(url)) {
    const msg = 'URL not allowed';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Citestack/1.0 (research library)' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  let cleanedText = '';
  let extractedTitle: string | null = null;
  let imageUrls: string[] = [];
  try {
    const { document } = parseHTML(html);

    // Set base URI for Readability (resolves relative links)
    const base = document.createElement('base');
    base.href = url;
    document.head?.appendChild(base);

    const reader = new Readability(document);
    const article = reader.parse();
    extractedTitle = article?.title?.trim() || null;
    cleanedText = article?.textContent?.trim() ?? '';
    if (!cleanedText) {
      const body = document.body?.textContent?.trim() ?? '';
      cleanedText = body.slice(0, 100_000);
    }

    const imgs = document.querySelectorAll('img');
    const seen = new Set<string>();
    for (const img of imgs) {
      const src = img.getAttribute('src')?.trim();
      if (!src || src.startsWith('data:')) continue;
      try {
        const absolute = new URL(src, url).href;
        if (!absolute.startsWith('http:') && !absolute.startsWith('https:')) continue;
        if (seen.has(absolute)) continue;
        seen.add(absolute);
        imageUrls.push(absolute);
        if (imageUrls.length >= 50) break;
      } catch {
        // skip invalid URLs
      }
    }
  } catch {
    const msg = 'Could not extract text from URL';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  const now = new Date().toISOString();
  let domain: string | null = null;
  try {
    const u = new URL(url);
    domain = u.hostname.replace(/^www\./, '') || null;
  } catch {
    // ignore
  }

  const { error: updateErr } = await admin
    .from('items')
    .update({
      raw_text: html.slice(0, 500_000),
      cleaned_text: cleanedText.slice(0, 500_000),
      status: 'extracted',
      extracted_at: now,
      updated_at: now,
      ...(domain && { domain }),
      ...(extractedTitle && { title: extractedTitle.slice(0, 500) }),
      image_urls: imageUrls,
    })
    .eq('id', itemId);

  if (updateErr) {
    const msg = 'Could not update item';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  await admin.from('jobs').insert({
    user_id: item.user_id,
    item_id: itemId,
    type: 'screenshot_url',
    payload: { itemId, url },
    status: 'queued',
  });

  const enrichResult = await enqueueEnrichItem(admin, item.user_id, itemId);
  if ('error' in enrichResult) {
    // Insufficient credits: skip enqueue; item stays extracted
    return {};
  }

  return {};
}

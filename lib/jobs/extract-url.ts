import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enqueueEnrichItem } from './enqueue-enrich';

const FETCH_TIMEOUT_MS = 15000;

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

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Clerkbook/1.0 (research library)' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed';
    return { error: msg };
  }

  let cleanedText = '';
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    cleanedText = article?.textContent?.trim() ?? '';
    if (!cleanedText) {
      const body = dom.window.document.body?.textContent?.trim() ?? '';
      cleanedText = body.slice(0, 100_000);
    }
  } catch {
    return { error: 'Could not extract text from URL' };
  }

  const { error: updateErr } = await admin
    .from('items')
    .update({
      raw_text: html.slice(0, 500_000),
      cleaned_text: cleanedText.slice(0, 500_000),
      status: 'extracted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (updateErr) return { error: 'Could not update item' };

  await enqueueEnrichItem(admin, item.user_id, itemId);

  return {};
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { isBlockedUrl } from '@/lib/url/blocklist';

const MICROLINK_TIMEOUT_MS = 30000;

export async function runScreenshotUrl(
  admin: SupabaseClient,
  _jobId: string,
  payload: { itemId: string; url?: string }
): Promise<{ error?: string }> {
  const { itemId, url: payloadUrl } = payload;
  if (!itemId) return { error: 'Missing itemId' };

  const { data: item, error: itemErr } = await admin
    .from('items')
    .select('id, user_id, source_type, url')
    .eq('id', itemId)
    .single();

  if (itemErr || !item) return { error: 'Item not found' };
  if (item.source_type !== 'url') return {};

  const url = payloadUrl ?? item.url;
  if (!url?.trim()) return {};

  if (isBlockedUrl(url)) return { error: 'URL not allowed' };

  const base = process.env.MICROLINK_API_KEY
    ? 'https://pro.microlink.io'
    : 'https://api.microlink.io';
  const apiUrl = `${base}?url=${encodeURIComponent(url)}&screenshot=true`;
  const headers: Record<string, string> = {};
  if (process.env.MICROLINK_API_KEY) {
    headers['x-api-key'] = process.env.MICROLINK_API_KEY;
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MICROLINK_TIMEOUT_MS);
    res = await fetch(apiUrl, { signal: controller.signal, headers });
    clearTimeout(timeout);
  } catch (e) {
    // Do not fail the item; leave thumbnail_url null
    return {};
  }

  if (!res.ok) return {};

  let json: { status?: string; data?: { screenshot?: { url?: string } } };
  try {
    json = await res.json();
  } catch {
    return {};
  }

  if (json.status !== 'success' || !json.data?.screenshot?.url) return {};

  const thumbnailUrl = String(json.data.screenshot.url).trim().slice(0, 2048);
  if (!thumbnailUrl) return {};

  await admin
    .from('items')
    .update({ thumbnail_url: thumbnailUrl, updated_at: new Date().toISOString() })
    .eq('id', itemId);

  return {};
}

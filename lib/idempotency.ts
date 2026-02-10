import type { SupabaseClient } from '@supabase/supabase-js';

const KEY_MAX_LENGTH = 256;

export function sanitizeIdempotencyKey(key: string | null): string | null {
  if (key == null || typeof key !== 'string') return null;
  const trimmed = key.trim().slice(0, KEY_MAX_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

export type StoredResponse = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Return cached response for (user_id, key) if present.
 */
export async function getCachedResponse(
  admin: SupabaseClient,
  userId: string,
  key: string
): Promise<StoredResponse | null> {
  const { data, error } = await admin
    .from('idempotency_keys')
    .select('response_json')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();

  if (error || !data?.response_json) return null;
  const json = data.response_json as { status?: number; body?: Record<string, unknown> };
  if (typeof json.status !== 'number' || !json.body || typeof json.body !== 'object') return null;
  return { status: json.status, body: json.body };
}

/**
 * Store response for (user_id, key). On conflict, update response_json.
 */
export async function storeResponse(
  admin: SupabaseClient,
  userId: string,
  key: string,
  status: number,
  body: Record<string, unknown>,
  requestFingerprint?: string | null
): Promise<void> {
  const responseJson = { status, body };
  await admin.from('idempotency_keys').upsert(
    {
      user_id: userId,
      key,
      request_fingerprint: requestFingerprint ?? null,
      response_json: responseJson,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,key' }
  );
}

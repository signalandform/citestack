import type { SupabaseClient } from '@supabase/supabase-js';
import { getBalance, getCreditCostEnrich } from '@/lib/credits';

export type EnqueueEnrichResult =
  | { jobId: string }
  | { skipped: boolean }
  | { error: 'insufficient_credits'; required: number; balance: number };

export async function enqueueEnrichItem(
  admin: SupabaseClient,
  userId: string,
  itemId: string,
  force?: boolean,
  mode?: string
): Promise<EnqueueEnrichResult> {
  const cost = getCreditCostEnrich(mode);
  const { balance } = await getBalance(admin, userId);
  if (balance < cost) {
    return { error: 'insufficient_credits', required: cost, balance };
  }

  if (!force) {
    const { data: existing } = await admin
      .from('jobs')
      .select('id')
      .eq('item_id', itemId)
      .eq('type', 'enrich_item')
      .in('status', ['queued', 'running'])
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return { skipped: true };
    }
  }

  const { data: job, error } = await admin
    .from('jobs')
    .insert({
      user_id: userId,
      item_id: itemId,
      type: 'enrich_item',
      payload: { itemId, mode: mode || undefined },
      status: 'queued',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error('Could not enqueue enrich job');
  }

  return { jobId: job!.id };
}

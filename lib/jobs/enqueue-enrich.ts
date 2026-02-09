import type { SupabaseClient } from '@supabase/supabase-js';

export async function enqueueEnrichItem(
  admin: SupabaseClient,
  userId: string,
  itemId: string,
  force?: boolean
): Promise<{ jobId?: string; skipped?: boolean }> {
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
      payload: { itemId },
      status: 'queued',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error('Could not enqueue enrich job');
  }

  return { jobId: job?.id };
}

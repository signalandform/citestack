import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreditReason } from './constants';

export type SpendOptions = {
  jobId?: string | null;
  itemId?: string | null;
};

/**
 * Deduct credits atomically. Returns { ok: true } if spent, { ok: false } if insufficient.
 */
export async function spendCredits(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  reason: CreditReason | string,
  options: SpendOptions = {}
): Promise<{ ok: boolean }> {
  if (amount <= 0) return { ok: false };

  const { data, error } = await admin.rpc('spend_credits', {
    p_user_id: userId,
    p_amount: Math.floor(amount),
    p_reason: reason,
    p_job_id: options.jobId ?? null,
    p_item_id: options.itemId ?? null,
  });

  if (error) return { ok: false };
  return { ok: data === true };
}

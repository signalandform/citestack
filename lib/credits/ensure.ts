import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_MONTHLY_GRANT } from './constants';

function firstOfNextMonthUTC(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (month > 11) {
    return new Date(Date.UTC(year + 1, 0, 1)).toISOString();
  }
  return new Date(Date.UTC(year, month, 1)).toISOString();
}

/**
 * Insert user_credits row if not exists. Idempotent.
 * New row: balance = monthly_grant, reset_at = first of next month UTC.
 */
export async function ensureUserCredits(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const resetAt = firstOfNextMonthUTC();
  await admin.from('user_credits').upsert(
    {
      user_id: userId,
      balance: DEFAULT_MONTHLY_GRANT,
      monthly_grant: DEFAULT_MONTHLY_GRANT,
      reset_at: resetAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id', ignoreDuplicates: true }
  );
}

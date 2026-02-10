import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * If now >= reset_at, add monthly_grant to balance, advance reset_at, and record in ledger.
 * Implemented via DB function for atomicity.
 */
export async function grantMonthlyCreditsIfDue(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  await admin.rpc('grant_monthly_credits_if_due', { p_user_id: userId });
}

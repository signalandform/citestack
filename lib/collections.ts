import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Add item to collection if the collection exists and belongs to the user.
 * Idempotent: uses upsert on collection_items.
 */
export async function addItemToCollection(
  admin: SupabaseClient,
  userId: string,
  itemId: string,
  collectionId: string
): Promise<void> {
  const trimmed = collectionId?.trim();
  if (!trimmed) return;

  const { data: coll } = await admin
    .from('collections')
    .select('id')
    .eq('id', trimmed)
    .eq('user_id', userId)
    .maybeSingle();

  if (coll?.id) {
    await admin.from('collection_items').upsert(
      { collection_id: trimmed, item_id: itemId },
      { onConflict: 'collection_id,item_id' }
    );
  }
}

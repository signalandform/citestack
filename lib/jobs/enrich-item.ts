import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  return new OpenAI({ apiKey: key });
}

export type Enriched = {
  title: string | null;
  abstract: string;
  bullets: string[];
  tags: string[];
  quotes: { quote: string; why_it_matters: string }[];
};

const ENRICH_SYSTEM = `You are a research assistant. Given the full text of a source (article, document, or paste), produce:
1. abstract: A 2-3 sentence summary of the main content.
2. bullets: 8-15 key points as an array of strings.
3. quotes: 5-12 key quotes from the text, each with a short "why_it_matters" explanation. Only use exact quotes from the text; do not fabricate.
4. tags: 8-20 reusable topic labels (lowercase, short, no spaces in a tag).
5. title: A concise title only if the text has no clear title; otherwise omit or null.

Respond with valid JSON only: { "abstract": "...", "bullets": ["point 1", "point 2", ...], "quotes": [ { "quote": "...", "why_it_matters": "..." } ], "tags": ["tag1", "tag2"], "title": "..." or null }`;

function parseEnrichResponse(text: string): Enriched | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Enriched;
  } catch {
    return null;
  }
}

function validateEnriched(data: unknown): data is Enriched {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.abstract !== 'string' || d.abstract.trim().length === 0) return false;
  if (!Array.isArray(d.bullets)) return false;
  if (d.bullets.length < 1 || d.bullets.length > 20) return false;
  if (!d.bullets.every((b: unknown) => typeof b === 'string')) return false;
  return true;
}

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

export async function runEnrichItem(
  admin: SupabaseClient,
  jobId: string,
  payload: { itemId: string }
): Promise<{ error?: string; truncated?: boolean }> {
  const { itemId } = payload;
  if (!itemId) return { error: 'Missing itemId' };

  const { data: item, error: itemErr } = await admin
    .from('items')
    .select('id, user_id, title, cleaned_text')
    .eq('id', itemId)
    .single();

  if (itemErr || !item) return { error: 'Item not found' };

  const text = item.cleaned_text?.trim() ?? '';
  if (!text) {
    const msg = 'Item has no text to enrich';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  if (text.length < 500) {
    const msg = 'Not enough extracted text to summarize';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  const wasTruncated = text.length > 120_000;
  const truncated = text.slice(0, 120_000);
  let enriched: Enriched | null = null;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: ENRICH_SYSTEM },
        { role: 'user', content: `Extract abstract, bullets, quotes, tags, and optional title from this text:\n\n${truncated}` },
      ],
      response_format: { type: 'json_object' },
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      const msg = 'Empty OpenAI response';
      await setItemFailed(admin, itemId, msg);
      return { error: msg };
    }
    enriched = parseEnrichResponse(content);
    if (!enriched) {
      try {
        enriched = JSON.parse(content) as Enriched;
      } catch {
        const msg = 'Could not parse OpenAI response';
        await setItemFailed(admin, itemId, msg);
        return { error: msg };
      }
    }
    if (!validateEnriched(enriched)) {
      const msg = 'Invalid enrichment: abstract required, bullets must be array of 1-20 strings';
      await setItemFailed(admin, itemId, msg);
      return { error: msg };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OpenAI request failed';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  const { abstract, bullets, quotes = [], tags: tagNames = [], title: enrichedTitle } = enriched;
  const userId = item.user_id;

  const summaryCompat = `${abstract}\n\n- ${bullets.join('\n- ')}`;

  const updates: Record<string, unknown> = {
    abstract,
    bullets,
    summary: summaryCompat,
    status: 'enriched',
    error: null,
    updated_at: new Date().toISOString(),
  };
  if (!item.title && enrichedTitle) updates.title = enrichedTitle;

  const { error: updateItemErr } = await admin
    .from('items')
    .update(updates)
    .eq('id', itemId);

  if (updateItemErr) {
    const msg = 'Could not update item';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  await admin.from('quotes').delete().eq('item_id', itemId);

  for (const q of quotes) {
    if (!q.quote?.trim()) continue;
    await admin.from('quotes').insert({
      user_id: userId,
      item_id: itemId,
      quote: q.quote.slice(0, 5000),
      why_it_matters: q.why_it_matters?.slice(0, 1000) ?? null,
    });
  }

  await admin.from('item_tags').delete().eq('item_id', itemId);

  for (const name of tagNames) {
    const tagName = String(name).trim().toLowerCase().slice(0, 100);
    if (!tagName) continue;
    const { data: existing } = await admin
      .from('tags')
      .select('id')
      .eq('user_id', userId)
      .eq('name', tagName)
      .single();

    let tagId: string;
    if (existing?.id) {
      tagId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from('tags')
        .insert({ user_id: userId, name: tagName })
        .select('id')
        .single();
      if (insErr || !inserted) continue;
      tagId = inserted.id;
    }

    await admin.from('item_tags').insert({ item_id: itemId, tag_id: tagId });
  }

  return wasTruncated ? { truncated: true } : {};
}

import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getBalance, getCreditCostCompare, spendCredits, REASON } from '@/lib/credits';
import { runCompareItems, type CompareResult } from '@/lib/jobs/compare-items';

export async function GET() {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: comparisons, error } = await admin
    .from('comparisons')
    .select('id, item_ids, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: 'Could not load comparisons' }, { status: 500 });
  }

  return NextResponse.json({ comparisons: comparisons ?? [] });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { itemIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
  const trimmed = itemIds
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean);

  if (trimmed.length < 2 || trimmed.length > 5) {
    return NextResponse.json(
      { error: 'Select 2–5 items to compare' },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  const cost = getCreditCostCompare(trimmed.length);
  const { balance } = await getBalance(admin, user.id);
  if (balance < cost) {
    return NextResponse.json(
      {
        error: 'Insufficient credits',
        message: `This comparison costs ${cost} credits; you have ${balance}. Credits reset monthly.`,
        required: cost,
        balance,
      },
      { status: 402 }
    );
  }

  const spent = await spendCredits(admin, user.id, cost, REASON.COMPARE_ITEMS, {});
  if (!spent.ok) {
    return NextResponse.json(
      { error: 'Insufficient credits', message: 'Could not deduct credits. Try again.' },
      { status: 402 }
    );
  }

  const { data: items, error } = await admin
    .from('items')
    .select('id, title, abstract, bullets')
    .eq('user_id', user.id)
    .in('id', trimmed);

  if (error || !items || items.length !== trimmed.length) {
    return NextResponse.json({ error: 'Could not load items' }, { status: 400 });
  }

  const itemIdsSet = new Set(trimmed);
  if (items.some((i) => !itemIdsSet.has(i.id))) {
    return NextResponse.json({ error: 'Some items not found' }, { status: 404 });
  }

  const { data: quotes } = await admin
    .from('quotes')
    .select('item_id, quote, why_it_matters')
    .eq('user_id', user.id)
    .in('item_id', trimmed);

  const quotesByItem = new Map<string, { quote: string; why_it_matters?: string }[]>();
  for (const q of quotes ?? []) {
    const arr = quotesByItem.get(q.item_id) ?? [];
    arr.push({ quote: q.quote, why_it_matters: q.why_it_matters ?? undefined });
    quotesByItem.set(q.item_id, arr);
  }

  const itemsForCompare = items.map((i) => ({
    id: i.id,
    title: i.title,
    abstract: i.abstract,
    bullets: (i.bullets ?? []) as string[],
    quotes: quotesByItem.get(i.id) ?? [],
  }));

  const { result, error: compareError } = await runCompareItems(itemsForCompare);

  if (compareError || !result) {
    return NextResponse.json(
      { error: compareError ?? 'Comparison failed' },
      { status: 500 }
    );
  }

  const { data: comparison, error: insertErr } = await admin
    .from('comparisons')
    .insert({
      user_id: user.id,
      item_ids: trimmed,
      result: result as unknown as Record<string, unknown>,
    })
    .select('id')
    .single();

  if (insertErr || !comparison) {
    return NextResponse.json({ error: 'Could not save comparison' }, { status: 500 });
  }

  return NextResponse.json({
    id: comparison.id,
    result: result as CompareResult,
  });
}

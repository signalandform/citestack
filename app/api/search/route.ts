import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (!q) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const escaped = q.replace(/"/g, '""');
  const pattern = `"%${escaped}%"`;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('items')
    .select('id, title, source_type, summary, status, created_at')
    .eq('user_id', user.id)
    .or(`title.ilike.${pattern},summary.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Could not search' }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { getAdminSecret } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCreditCostEnrich, spendCredits, REASON } from '@/lib/credits';
import { runExtractUrl } from '@/lib/jobs/extract-url';
import { runExtractFile } from '@/lib/jobs/extract-file';
import { runEnrichItem } from '@/lib/jobs/enrich-item';
import { runScreenshotUrl } from '@/lib/jobs/screenshot-url';

async function runJobs(request: Request) {
  const secret = getAdminSecret(request);
  const expected = process.env.CITESTACK_ADMIN_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') ?? '5', 10)), 20);

  const admin = supabaseAdmin();

  const stuckThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await admin
    .from('jobs')
    .update({ status: 'queued', started_at: null })
    .eq('status', 'running')
    .lt('started_at', stuckThreshold);

  const { data: queued } = await admin
    .from('jobs')
    .select('id, user_id, item_id, type, payload')
    .eq('status', 'queued')
    .or('run_after.is.null,run_after.lte.' + new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!queued?.length) {
    return NextResponse.json({ processed: 0, message: 'No queued jobs' });
  }

  const claimed: string[] = [];
  for (const row of queued) {
    const { data: claimedOk } = await admin.rpc('claim_job', { p_id: row.id });
    if (claimedOk) claimed.push(row.id);
  }

  const jobsToRun = queued.filter((j) => claimed.includes(j.id));

  for (const job of jobsToRun) {
    const payload = (job.payload as Record<string, unknown>) ?? {};
    let result: { error?: string } = {};

    try {
      if (job.type === 'extract_url') {
        result = await runExtractUrl(admin, job.id, payload as { itemId: string; url: string });
      } else if (job.type === 'extract_file') {
        result = await runExtractFile(admin, job.id, payload as {
          itemId: string;
          filePath: string;
          mimeType: string;
        });
      } else if (job.type === 'enrich_item') {
        const enrichPayload = payload as { itemId: string; mode?: string };
        const cost = getCreditCostEnrich(enrichPayload.mode);
        const reason = enrichPayload.mode === 'tags_only' ? REASON.ENRICH_TAGS_ONLY : REASON.ENRICH_FULL;
        const spent = await spendCredits(admin, job.user_id, cost, reason, {
          jobId: job.id,
          itemId: job.item_id ?? undefined,
        });
        if (!spent.ok) {
          result = { error: 'Insufficient credits' };
        } else {
          result = await runEnrichItem(admin, job.id, enrichPayload);
        }
      } else if (job.type === 'screenshot_url') {
        result = await runScreenshotUrl(admin, job.id, payload as { itemId: string; url?: string });
      } else {
        result = { error: 'Unknown job type' };
      }
    } catch (e) {
      result = { error: e instanceof Error ? e.message : 'Job failed' };
    }

    const isFailed = !!result.error;
    const { data: jobRow } = await admin
      .from('jobs')
      .select('attempts, max_attempts')
      .eq('id', job.id)
      .single();

    const attempts = jobRow?.attempts ?? 1;
    const maxAttempts = jobRow?.max_attempts ?? 3;
    const shouldRetry = isFailed && attempts < maxAttempts;

    if (shouldRetry) {
      const backoffMinutes = Math.min(2 ** attempts, 60);
      const runAfter = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
      await admin
        .from('jobs')
        .update({
          status: 'queued',
          started_at: null,
          run_after: runAfter,
          error: result.error,
          result: null,
          finished_at: null,
        })
        .eq('id', job.id);
    } else {
      await admin
        .from('jobs')
        .update({
          status: isFailed ? 'failed' : 'succeeded',
          error: isFailed ? result.error : null,
          result: isFailed ? null : (result as Record<string, unknown>),
          finished_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  }

  return NextResponse.json({
    processed: jobsToRun.length,
    claimed: claimed.length,
  });
}

export async function POST(request: Request) {
  return runJobs(request);
}

export async function GET(request: Request) {
  return runJobs(request);
}

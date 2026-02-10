import mammoth from 'mammoth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enqueueEnrichItem } from './enqueue-enrich';

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

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    await parser.destroy();
    return (result?.text ?? '').trim();
  } catch {
    await parser.destroy();
    throw new Error('Could not parse PDF');
  }
}

export async function runExtractFile(
  admin: SupabaseClient,
  jobId: string,
  payload: { itemId: string; filePath: string; mimeType: string }
): Promise<{ error?: string }> {
  const { itemId, filePath, mimeType } = payload;
  if (!itemId || !filePath) return { error: 'Missing itemId or filePath' };

  const { data: item, error: itemErr } = await admin
    .from('items')
    .select('id, user_id')
    .eq('id', itemId)
    .single();

  if (itemErr || !item) return { error: 'Item not found' };

  const { data: blob, error: downloadErr } = await admin.storage
    .from('library-files')
    .download(filePath);

  if (downloadErr || !blob) {
    const msg = 'Could not download file';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  let cleanedText = '';

  const mt = mimeType.toLowerCase();
  if (mt === 'application/pdf') {
    try {
      cleanedText = await extractPdf(buffer);
    } catch {
      const msg = 'Could not parse PDF';
      await setItemFailed(admin, itemId, msg);
      return { error: msg };
    }
  } else if (
    mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      cleanedText = result.value.trim();
    } catch {
      const msg = 'Could not parse DOCX';
      await setItemFailed(admin, itemId, msg);
      return { error: msg };
    }
  } else if (mt === 'text/plain' || mt === 'text/markdown') {
    cleanedText = buffer.toString('utf-8').trim();
  } else {
    const msg = 'Unsupported file type';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from('items')
    .update({
      cleaned_text: cleanedText.slice(0, 500_000),
      status: 'extracted',
      extracted_at: now,
      updated_at: now,
    })
    .eq('id', itemId);

  if (updateErr) {
    const msg = 'Could not update item';
    await setItemFailed(admin, itemId, msg);
    return { error: msg };
  }

  const enrichResult = await enqueueEnrichItem(admin, item.user_id, itemId);
  if ('error' in enrichResult) {
    // Insufficient credits: skip enqueue; item stays extracted
    return {};
  }

  return {};
}

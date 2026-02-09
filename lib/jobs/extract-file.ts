import mammoth from 'mammoth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enqueueEnrichItem } from './enqueue-enrich';

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

  if (downloadErr || !blob) return { error: 'Could not download file' };

  const buffer = Buffer.from(await blob.arrayBuffer());
  let cleanedText = '';

  const mt = mimeType.toLowerCase();
  if (mt === 'application/pdf') {
    try {
      cleanedText = await extractPdf(buffer);
    } catch (e) {
      return { error: 'Could not parse PDF' };
    }
  } else if (
    mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      cleanedText = result.value.trim();
    } catch {
      return { error: 'Could not parse DOCX' };
    }
  } else if (mt === 'text/plain' || mt === 'text/markdown') {
    cleanedText = buffer.toString('utf-8').trim();
  } else {
    return { error: 'Unsupported file type' };
  }

  const { error: updateErr } = await admin
    .from('items')
    .update({
      cleaned_text: cleanedText.slice(0, 500_000),
      status: 'extracted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (updateErr) return { error: 'Could not update item' };

  await enqueueEnrichItem(admin, item.user_id, itemId);

  return {};
}

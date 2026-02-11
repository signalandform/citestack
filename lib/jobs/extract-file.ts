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
  // pdf-parse export shape differs across CJS/ESM + bundlers (especially under Turbopack).
  // Use Node's require to load it as a runtime dependency in serverless.
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);

  // pdf-parse uses pdfjs-dist under the hood. In serverless environments, pdfjs may
  // try to dynamically load @napi-rs/canvas to polyfill DOMMatrix/ImageData/Path2D.
  // Load it at runtime (not bundled) so Turbopack doesn't choke on native assets.
  try {
    require('@napi-rs/canvas');
  } catch {
    // If canvas can't load, pdfjs-dist may throw DOMMatrix-related errors.
    // We'll surface that downstream.
  }

  const mod = require('pdf-parse') as unknown;

  // v1.x exported a callable function; v2.x exports a module with a PDFParse class.
  const candidate = (mod as { default?: unknown })?.default ?? mod;

  if (typeof candidate === 'function') {
    const pdfParse = candidate as (buf: Buffer) => Promise<{ text?: string } | undefined>;
    const data = await pdfParse(buffer);
    return (data?.text ?? '').trim();
  }

  const PDFParse = (mod as { PDFParse?: unknown })?.PDFParse;
  if (typeof PDFParse === 'function') {
    // pdf-parse@2 exports a PDFParse class which expects options in the constructor.
    // Passing the data buffer here avoids relying on any mutable internal state.
    const parser = new (PDFParse as new (opts: {
      data: Uint8Array | Buffer;
      verbosity?: number;
      disableWorker?: boolean;
    }) => {
      getText: () => Promise<{ text?: string } | { text: string } | { text: string; pages?: unknown[] }>;
      destroy?: () => void | Promise<void>;
    })({ data: buffer, verbosity: 0, disableWorker: true });

    const result = await parser.getText();
    await parser.destroy?.();

    const text = (result as { text?: string } | undefined)?.text ?? '';
    return text.trim();
  }

  throw new Error('Unsupported pdf-parse export shape');
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
    } catch (e) {
      console.error('PDF extraction failed', e);
      const realMsg = e instanceof Error ? e.message : String(e);
      const msg = ('Could not parse PDF: ' + realMsg).slice(0, 240).trim();
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

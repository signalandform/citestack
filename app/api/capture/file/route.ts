import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getCachedResponse,
  storeResponse,
  sanitizeIdempotencyKey,
} from '@/lib/idempotency';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];
const ALLOWED_EXT = ['.pdf', '.docx', '.txt', '.md'];
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
}

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idempotencyKey = sanitizeIdempotencyKey(request.headers.get('idempotency-key'));
    const admin = supabaseAdmin();

    if (idempotencyKey) {
      const cached = await getCachedResponse(admin, user.id, idempotencyKey);
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status });
      }
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: 'Invalid form data. Please try again.' },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file selected.' }, { status: 400 });
    }

    const f = file as File;
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File is too large. Maximum size is 50MB.` },
        { status: 413 }
      );
    }
    if (f.size === 0) {
      return NextResponse.json(
        { error: 'File is empty.' },
        { status: 400 }
      );
    }

    const mimeType = f.type || 'application/octet-stream';
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'File type not allowed. Use PDF, DOCX, TXT, or MD.' },
        { status: 400 }
      );
    }

    const name = f.name || 'file';
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    if (!ALLOWED_EXT.includes(ext.toLowerCase())) {
      return NextResponse.json(
        { error: 'File type not allowed. Use PDF, DOCX, TXT, or MD.' },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await f.arrayBuffer());
    const fileSha256 = sha256Hex(buf);

    const collectionId =
      typeof formData.get('collectionId') === 'string'
        ? formData.get('collectionId') as string
        : undefined;
    const collectionIdTrimmed = collectionId?.trim();

    const now = new Date().toISOString();

    const { data: existing } = await admin
      .from('items')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('source_type', 'file')
      .eq('file_sha256', fileSha256)
      .maybeSingle();

    if (existing) {
      await admin
        .from('items')
        .update({ last_saved_at: now, updated_at: now })
        .eq('id', existing.id);

      if (collectionIdTrimmed) {
        const { data: coll } = await admin
          .from('collections')
          .select('id')
          .eq('id', collectionIdTrimmed)
          .eq('user_id', user.id)
          .maybeSingle();
        if (coll?.id) {
          await admin.from('collection_items').upsert(
            { collection_id: collectionIdTrimmed, item_id: existing.id },
            { onConflict: 'collection_id,item_id' }
          );
        }
      }

      const responseBody = {
        itemId: existing.id,
        deduped: true,
        status: existing.status,
      };
      if (idempotencyKey) {
        await storeResponse(admin, user.id, idempotencyKey, 200, responseBody);
      }
      return NextResponse.json(responseBody, { status: 200 });
    }

    const { data: item, error: itemError } = await admin
      .from('items')
      .insert({
        user_id: user.id,
        source_type: 'file',
        file_path: null,
        mime_type: mimeType,
        original_filename: name,
        file_sha256: fileSha256,
        status: 'captured',
        last_saved_at: now,
      })
      .select('id')
      .single();

    if (itemError || !item) {
      const isUniqueViolation =
        (itemError as { code?: string })?.code === '23505' ||
        (itemError?.message ?? '').includes('duplicate key');
      if (isUniqueViolation) {
        const { data: existingByHash } = await admin
          .from('items')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('source_type', 'file')
          .eq('file_sha256', fileSha256)
          .maybeSingle();
        if (existingByHash) {
          await admin
            .from('items')
            .update({ last_saved_at: now, updated_at: now })
            .eq('id', existingByHash.id);
          if (collectionIdTrimmed) {
            const { data: coll } = await admin
              .from('collections')
              .select('id')
              .eq('id', collectionIdTrimmed)
              .eq('user_id', user.id)
              .maybeSingle();
            if (coll?.id) {
              await admin.from('collection_items').upsert(
                { collection_id: collectionIdTrimmed, item_id: existingByHash.id },
                { onConflict: 'collection_id,item_id' }
              );
            }
          }
          const responseBody = {
            itemId: existingByHash.id,
            deduped: true,
            status: existingByHash.status,
          };
          if (idempotencyKey) {
            await storeResponse(admin, user.id, idempotencyKey, 200, responseBody);
          }
          return NextResponse.json(responseBody, { status: 200 });
        }
      }
      return NextResponse.json(
        { error: 'Could not create item. Please try again.' },
        { status: 500 }
      );
    }

    const path = `${user.id}/${item.id}/${sanitizeFilename(name)}`;

    const { error: uploadError } = await admin.storage
      .from('library-files')
      .upload(path, buf, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      await admin.from('items').delete().eq('id', item.id);
      const msg =
        uploadError.message?.includes('quota') || uploadError.message?.includes('limit')
          ? 'Storage limit reached. Try a smaller file or free some space.'
          : uploadError.message?.includes('already exists')
            ? 'A file with this name already exists. Rename it and try again.'
            : 'Could not upload file. Please try again.';
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const { error: updateError } = await admin
      .from('items')
      .update({ file_path: path })
      .eq('id', item.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Could not save file. Please try again.' },
        { status: 500 }
      );
    }

    const { error: jobError } = await admin.from('jobs').insert({
      user_id: user.id,
      item_id: item.id,
      type: 'extract_file',
      payload: { itemId: item.id, filePath: path, mimeType },
      status: 'queued',
    });

    if (jobError) {
      return NextResponse.json(
        { error: 'File uploaded but processing could not start. Check the item in your library.' },
        { status: 500 }
      );
    }

    if (collectionIdTrimmed) {
      const { data: coll } = await admin
        .from('collections')
        .select('id')
        .eq('id', collectionIdTrimmed)
        .eq('user_id', user.id)
        .maybeSingle();
      if (coll?.id) {
        await admin.from('collection_items').upsert(
          { collection_id: collectionIdTrimmed, item_id: item.id },
          { onConflict: 'collection_id,item_id' }
        );
      }
    }

    const responseBody = {
      itemId: item.id,
      deduped: false,
      status: 'captured',
    };
    if (idempotencyKey) {
      await storeResponse(admin, user.id, idempotencyKey, 201, responseBody);
    }
    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

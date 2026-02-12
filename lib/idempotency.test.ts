import { describe, expect, it, vi } from 'vitest';
import {
  sanitizeIdempotencyKey,
  getCachedResponse,
  storeResponse,
} from './idempotency';

describe('sanitizeIdempotencyKey', () => {
  it('returns null for null or undefined', () => {
    expect(sanitizeIdempotencyKey(null)).toBeNull();
    expect(sanitizeIdempotencyKey(undefined as unknown as string)).toBeNull();
  });

  it('returns null for empty or whitespace-only string', () => {
    expect(sanitizeIdempotencyKey('')).toBeNull();
    expect(sanitizeIdempotencyKey('   ')).toBeNull();
  });

  it('trims and returns non-empty key', () => {
    expect(sanitizeIdempotencyKey('  abc-123  ')).toBe('abc-123');
  });

  it('truncates to 256 chars', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeIdempotencyKey(long)!.length).toBe(256);
  });
});

describe('getCachedResponse', () => {
  it('returns null when no cached response', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: mockMaybeSingle }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof getCachedResponse>[0];

    const result = await getCachedResponse(admin, 'user-1', 'key-1');
    expect(result).toBeNull();
  });

  it('returns cached response when valid', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { response_json: { status: 200, body: { itemId: 'item-1' } } },
      error: null,
    });
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: mockMaybeSingle }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof getCachedResponse>[0];

    const result = await getCachedResponse(admin, 'user-1', 'key-1');
    expect(result).toEqual({ status: 200, body: { itemId: 'item-1' } });
  });
});

describe('storeResponse', () => {
  it('calls upsert with correct payload', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: () => ({ upsert: mockUpsert }),
    } as unknown as Parameters<typeof storeResponse>[0];

    await storeResponse(admin, 'user-1', 'key-1', 201, { itemId: 'item-1' });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        key: 'key-1',
        response_json: { status: 201, body: { itemId: 'item-1' } },
      }),
      { onConflict: 'user_id,key' }
    );
  });
});

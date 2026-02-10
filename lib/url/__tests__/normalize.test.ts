import { describe, expect, it } from 'vitest';
import { canonicalizeUrl } from '../normalize';

describe('canonicalizeUrl', () => {
  it('returns same canonical for URL with and without fragment', () => {
    const withHash = canonicalizeUrl('https://example.com/page#section');
    const withoutHash = canonicalizeUrl('https://example.com/page');
    expect(withHash).toBe(withoutHash);
    expect(withHash).toBe('https://example.com/page');
  });

  it('returns same canonical for URL with and without utm params', () => {
    const withUtm = canonicalizeUrl('https://example.com/article?utm_source=twitter&utm_medium=social');
    const withoutUtm = canonicalizeUrl('https://example.com/article');
    expect(withUtm).toBe(withoutUtm);
    expect(withUtm).toBe('https://example.com/article');
  });

  it('strips fbclid and gclid', () => {
    const withTracking = canonicalizeUrl('https://example.com?fbclid=abc&gclid=xyz');
    expect(withTracking).toBe('https://example.com/');
  });

  it('normalizes trailing slash (except root)', () => {
    const withSlash = canonicalizeUrl('https://example.com/path/');
    const withoutSlash = canonicalizeUrl('https://example.com/path');
    expect(withSlash).toBe(withoutSlash);
    expect(withSlash).toBe('https://example.com/path');
  });

  it('keeps root path as single slash', () => {
    expect(canonicalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('lowercases hostname', () => {
    expect(canonicalizeUrl('https://Example.COM/Page')).toBe('https://example.com/Page');
  });

  it('preserves non-tracking query params and sorts them', () => {
    const a = canonicalizeUrl('https://example.com?b=2&a=1');
    expect(a).toBe('https://example.com/?a=1&b=2');
  });

  it('returns null for empty or invalid URL', () => {
    expect(canonicalizeUrl('')).toBeNull();
    expect(canonicalizeUrl('   ')).toBeNull();
    expect(canonicalizeUrl('not-a-url')).toBeNull();
    expect(canonicalizeUrl('ftp://example.com')).toBeNull();
  });
});

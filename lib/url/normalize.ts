/**
 * Tracking query params to strip for canonical URL.
 */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  'ref',
]);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  if (TRACKING_PARAMS.has(lower)) return true;
  if (lower.startsWith('utm_')) return true;
  return false;
}

/**
 * Normalize URL to a deterministic canonical form for dedupe.
 * Strips fragment, normalizes protocol (https), lowercase hostname,
 * removes default port, trailing slash (except root), and tracking query params.
 */
export function canonicalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (!/^https?:$/i.test(parsed.protocol)) return null;

  const protocol = 'https:';
  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port;
  const defaultPort = parsed.protocol === 'https:' ? '443' : '80';
  const portPart = port && port !== defaultPort ? `:${port}` : '';
  let pathname = parsed.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of parsed.searchParams) {
    if (!isTrackingParam(key)) {
      searchParams.set(key, value);
    }
  }
  const keys = Array.from(searchParams.keys()).sort();
  const query =
    keys.length > 0
      ? '?' +
        keys
          .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(searchParams.get(k)!)}`)
          .join('&')
      : '';

  return `${protocol}//${hostname}${portPart}${pathname}${query}`;
}

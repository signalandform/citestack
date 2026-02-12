/**
 * SSRF mitigation: block URLs that resolve to internal/metadata addresses.
 * Prevents fetching from localhost, private ranges, link-local (169.254.x.x), etc.
 */
export function isBlockedUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]') return true;
  if (hostname === '0.0.0.0') return true;

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;

    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }

  return false;
}

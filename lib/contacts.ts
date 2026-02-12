/**
 * Extract contact information from text: emails, phones, addresses, usernames with platforms.
 * Uses regex; normalizes and dedupes.
 */

export type ItemContacts = {
  emails: string[];
  phones: string[];
  addresses: string[];
  usernames: { username: string; platform: string }[];
};

const EMAIL_RE =
  /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;

// Common phone patterns: (xxx) xxx-xxxx, xxx-xxx-xxxx, +1 xxx xxx xxxx, international +digits
const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}|(?:\+\d{1,3}[-.\s]?)?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}(?:[-.\s]?\d+)?/g;

// Simple address patterns: number + street name (one or two words), optional city/state/zip
const ADDRESS_RE =
  /\d+\s+[A-Za-z0-9\s.,'-]{5,80}(?:\s+(?:Ave|Blvd|St|Street|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place|Way|Pkwy|Hwy|Suite|Ste|Apt|#)\b[^.\n]*)?/g;

// Platform URL patterns -> { username, platform }
const PLATFORM_PATTERNS: { re: RegExp; platform: string }[] = [
  { re: /(?:https?:\/\/)?(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)/gi, platform: 'Twitter' },
  { re: /(?:https?:\/\/)?(?:www\.)?x\.com\/([a-zA-Z0-9_]+)/gi, platform: 'X' },
  { re: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/gi, platform: 'LinkedIn' },
  { re: /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/gi, platform: 'GitHub' },
  { re: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/gi, platform: 'Instagram' },
  { re: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|channel\/)([a-zA-Z0-9_-]+)/gi, platform: 'YouTube' },
  { re: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/gi, platform: 'TikTok' },
  { re: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([a-zA-Z0-9.]+)/gi, platform: 'Facebook' },
  { re: /(?:https?:\/\/)?(?:www\.)?medium\.com\/@([a-zA-Z0-9_-]+)/gi, platform: 'Medium' },
];

// Standalone @handle (no URL) - treat as "Handle" or "Social"
const AT_HANDLE_RE = /@([a-zA-Z0-9_]{2,32})\b/g;

function dedupeStrings(arr: string[], normalize?: (s: string) => string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const key = normalize ? normalize(s) : s;
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(s.trim());
    }
  }
  return out;
}

function dedupeUsernames(
  arr: { username: string; platform: string }[]
): { username: string; platform: string }[] {
  const seen = new Set<string>();
  const out: { username: string; platform: string }[] = [];
  for (const u of arr) {
    const key = `${u.platform}:${u.username.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ username: u.username.trim(), platform: u.platform });
    }
  }
  return out;
}

export function extractContacts(text: string | null | undefined): ItemContacts {
  const raw = (text ?? '').trim();
  if (!raw) {
    return { emails: [], phones: [], addresses: [], usernames: [] };
  }

  const emails = [...(raw.match(EMAIL_RE) ?? [])].map((e) => e.toLowerCase().trim());
  const phones = [...(raw.match(PHONE_RE) ?? [])].map((p) => p.replace(/\s+/g, ' ').trim());
  const addresses = [...(raw.match(ADDRESS_RE) ?? [])].map((a) => a.replace(/\s+/g, ' ').trim());

  const usernames: { username: string; platform: string }[] = [];

  for (const { re, platform } of PLATFORM_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const username = m[1];
      if (username) usernames.push({ username, platform });
    }
  }

  let m: RegExpExecArray | null;
  AT_HANDLE_RE.lastIndex = 0;
  while ((m = AT_HANDLE_RE.exec(raw)) !== null) {
    const username = m[1];
    if (username) usernames.push({ username, platform: 'Handle' });
  }

  return {
    emails: dedupeStrings(emails, (s) => s.toLowerCase()),
    phones: dedupeStrings(phones),
    addresses: dedupeStrings(addresses),
    usernames: dedupeUsernames(usernames),
  };
}

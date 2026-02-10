'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/app/components/app-shell';
import { CollectionPicker } from '@/app/components/collection-picker';
import { CoverageBadge } from '@/app/components/coverage-badge';
import { OnboardingHighlight } from '@/app/components/onboarding';
import { useToast } from '@/app/contexts/toast';
import { getItemDisplayTitle } from '@/lib/item-display';
import { INSUFFICIENT_TEXT_MESSAGE } from '@/lib/constants';

type Quote = { id: string; quote: string; why_it_matters: string | null };
type ItemContacts = {
  emails?: string[];
  phones?: string[];
  addresses?: string[];
  usernames?: { username: string; platform: string }[];
};
type Item = {
  id: string;
  title: string | null;
  source_type: string;
  url: string | null;
  domain: string | null;
  status: string;
  abstract: string | null;
  bullets: string[] | null;
  summary: string | null;
  error: string | null;
  raw_text: string | null;
  cleaned_text: string | null;
  original_filename: string | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
  extracted_at: string | null;
  enriched_at: string | null;
  quotes: Quote[];
  tags: string[];
  collection_ids?: string[];
  thumbnail_url?: string | null;
  image_urls?: string[] | null;
  contacts?: ItemContacts | null;
  authors?: string[] | null;
  publisher?: string | null;
  published_at?: string | null;
  accessed_at?: string | null;
  doi?: string | null;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { showToast } = useToast();
  const [sourceExpanded, setSourceExpanded] = useState<boolean | null>(null);
  const [highlightPhrase, setHighlightPhrase] = useState<string | null>(null);
  const [quoteNotFound, setQuoteNotFound] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState('');
  const [screenshotFullscreen, setScreenshotFullscreen] = useState(false);
  const [citationAccessedOn, setCitationAccessedOn] = useState(() => todayISO());
  const [citations, setCitations] = useState<{ apa: string; mla: string; chicago: string } | null>(null);
  const [citationsLoading, setCitationsLoading] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);

  const fetchCollections = useCallback(() => {
    fetch('/api/collections')
      .then((r) => r.json())
      .then((data) => setCollections(data.collections ?? []))
      .catch(() => setCollections([]));
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    if (!id || !item) {
      setCitations(null);
      return;
    }
    setCitationsLoading(true);
    fetch('/api/citations/formatted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: id, accessedAt: citationAccessedOn }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load citations'))))
      .then((data) => setCitations({ apa: data.apa, mla: data.mla, chicago: data.chicago }))
      .catch(() => setCitations(null))
      .finally(() => setCitationsLoading(false));
  }, [id, item, citationAccessedOn]);

  function startEditTitle() {
    setTitleEditValue(getItemDisplayTitle(item!));
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }

  async function saveTitle() {
    if (!id || !item) return;
    const trimmed = titleEditValue.trim();
    setEditingTitle(false);
    if (trimmed === getItemDisplayTitle(item)) return;
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setItem((prev) => (prev ? { ...prev, title: data.title } : null));
        showToast('Title updated', 'success');
      }
    } catch {
      showToast('Failed to update title', 'error');
    }
  }

  function formatCitation(): string {
    if (!item) return '';
    const label = getItemDisplayTitle(item);
    if (item.source_type === 'url' && item.url) {
      return `(Source: ${label}, ${item.url})`;
    }
    return `(Source: ${label})`;
  }

  function handleQuoteClick(quote: string) {
    const unquoted = quote.replace(/^["']|["']$/g, '').trim();
    const content = item?.cleaned_text || '';
    setQuoteNotFound(null);
    setHighlightPhrase(null);
    if (!content) {
      setQuoteNotFound(unquoted);
      return;
    }
    const idx = content.indexOf(unquoted);
    if (idx === -1) {
      setQuoteNotFound(unquoted);
      return;
    }
    setSourceExpanded(true);
    setHighlightPhrase(unquoted);
    setTimeout(() => sourceRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function copyWithFeedback(text: string, withCitation: boolean) {
    const final = withCitation ? `${text}\n${formatCitation()}` : text;
    try {
      await navigator.clipboard.writeText(final);
      showToast(withCitation ? 'Copied with citation' : 'Copied', 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  }

  const fetchItem = useCallback(() => {
    if (!id) return;
    fetch(`/api/items/${id}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('notfound');
          throw new Error('Failed to load');
        }
        return res.json();
      })
      .then((data) => {
        setItem(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message === 'notfound' ? 'Item not found' : 'Could not load item');
        setItem(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) {
      setError('Invalid item');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchItem();
  }, [id, fetchItem]);

  // Poll for status updates when processing
  useEffect(() => {
    if (!item || !id) return;
    if (item.status === 'enriched' || item.status === 'failed') return;

    const interval = setInterval(fetchItem, 3000);
    return () => clearInterval(interval);
  }, [id, item?.status, fetchItem]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setScreenshotFullscreen(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  async function handleRetry() {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/items/${id}/retry`, { method: 'POST' });
      await res.json();
      showToast('Retry queued', 'success');
      fetchItem();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddTag(tag: string) {
    const name = tag.trim().toLowerCase().slice(0, 100);
    if (!name || !id) return;
    try {
      const res = await fetch(`/api/items/${id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: name }),
      });
      if (res.ok) {
        setTagInput('');
        setTagDropdownOpen(false);
        fetchItem();
      }
    } catch {
      // ignore
    }
  }

  async function handleRemoveTag(tag: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    try {
      const res = await fetch(`/api/items/${id}/tags?tag=${encodeURIComponent(tag)}`, { method: 'DELETE' });
      if (res.ok) fetchItem();
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!tagInput.trim()) {
      setTagSuggestions([]);
      setTagDropdownOpen(false);
      return;
    }
    const q = tagInput.trim().toLowerCase();
    fetch('/api/tags')
      .then((r) => r.json())
      .then((data: { tags?: string[] }) => {
        const currentTags = new Set(item?.tags ?? []);
        const suggestions = (data.tags ?? [])
          .filter((t) => t.toLowerCase().includes(q) && !currentTags.has(t))
          .slice(0, 8);
        setTagSuggestions(suggestions);
        setTagDropdownOpen(suggestions.length > 0 || q.length > 0);
      })
      .catch(() => setTagSuggestions([]));
  }, [tagInput, item?.tags]);

  async function handleReEnrich(mode?: string) {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      const url = mode ? `/api/items/${id}/re-enrich?mode=${encodeURIComponent(mode)}` : `/api/items/${id}/re-enrich`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message ?? data.error ?? 'Re-enrich failed', 'error');
        return;
      }
      showToast('Re-enrich queued', 'success');
      fetchItem();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!id || actionLoading) return;
    if (!confirm('Delete this item? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Item deleted', 'success');
        router.push('/library');
      } else {
        showToast('Could not delete item', 'error');
      }
    } catch {
      showToast('Could not delete item', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl p-6">
          <p className="text-sm text-[var(--fg-muted)]">Loading…</p>
        </main>
      </AppShell>
    );
  }

  if (error && !item) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl p-6">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <p className="mt-4">
            <Link href="/library" className="text-sm text-[var(--accent)] underline hover:no-underline">
              Back to Library
            </Link>
          </p>
        </main>
      </AppShell>
    );
  }

  if (!item) return null;

  const content = item.cleaned_text || item.raw_text;
  const defaultCollapsed = (content?.length ?? 0) > 2000;
  const isExpanded = sourceExpanded ?? !defaultCollapsed;

  function renderSourceWithHighlight(text: string): React.ReactNode {
    if (!text || !highlightPhrase) return text;
    const idx = text.indexOf(highlightPhrase);
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + highlightPhrase.length);
    const after = text.slice(idx + highlightPhrase.length);
    return (
      <>
        {before}
        <mark className="rounded bg-[#fff8c5] dark:bg-yellow-900/40">{match}</mark>
        {after}
      </>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-6">
        <p className="mb-4">
          <Link href="/library" className="text-sm text-[var(--accent)] underline hover:no-underline">
            Back to Library
          </Link>
        </p>

        {/* Source preview block */}
        <section className="mb-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm">
          <p className="font-medium text-[var(--fg-default)]">Source</p>
          {item.source_type === 'url' && item.url && (
            <div className="mt-2 text-[var(--fg-muted)]">
              {item.thumbnail_url && (
                <button
                  type="button"
                  onClick={() => setScreenshotFullscreen(true)}
                  className="mb-2 block w-full cursor-pointer text-left"
                  title="Click to expand"
                >
                  <img
                    src={item.thumbnail_url}
                    alt="Screenshot preview"
                    className="h-[120px] w-full rounded border border-[var(--border-default)] object-cover object-top"
                  />
                </button>
              )}
              <p>{item.domain || item.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</p>
              <p className="mt-0.5 font-medium text-[var(--fg-default)]">{item.title || 'Untitled'}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">{item.url}</p>
            </div>
          )}
          {item.source_type === 'file' && (
            <div className="mt-2 text-[var(--fg-muted)]">
              <p className="font-medium text-[var(--fg-default)]">{item.original_filename || 'File'}</p>
              {item.mime_type && <p className="text-xs">{item.mime_type}</p>}
            </div>
          )}
          {item.source_type === 'paste' && (
            <div className="mt-2 text-[var(--fg-muted)]">
              <p>Paste — {(item.cleaned_text?.length ?? 0).toLocaleString()} characters</p>
            </div>
          )}
        </section>

        {item.source_type === 'url' && item.image_urls && item.image_urls.length > 0 && (
          <section className="mb-4">
            <h2 className="text-sm font-medium text-[var(--fg-default)]">Images from source</h2>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {item.image_urls.slice(0, 20).map((imgUrl, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded border border-[var(--border-default)]"
                >
                  <a
                    href={imgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={imgUrl}
                      alt=""
                      className="h-[120px] w-full object-cover object-center"
                    />
                  </a>
                  <a
                    href={`/api/items/${id}/image-download?url=${encodeURIComponent(imgUrl)}&index=${i + 1}`}
                    download
                    className="block border-t border-[var(--border-default)] bg-[var(--bg-inset)] px-2 py-1 text-center text-xs text-[var(--accent)] hover:bg-[var(--draft-muted)]"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
            {item.image_urls.length > 20 && (
              <p className="mt-2 text-xs text-[var(--fg-muted)]">
                and {item.image_urls.length - 20} more
              </p>
            )}
          </section>
        )}

        {item.contacts &&
          ((item.contacts.emails?.length ?? 0) > 0 ||
            (item.contacts.phones?.length ?? 0) > 0 ||
            (item.contacts.addresses?.length ?? 0) > 0 ||
            (item.contacts.usernames?.length ?? 0) > 0) && (
          <section className="mb-4">
            <h2 className="text-sm font-medium text-[var(--fg-default)]">Contact information</h2>
            <div className="mt-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--fg-default)]">
              {item.contacts.emails && item.contacts.emails.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-[var(--fg-muted)]">Email</p>
                  <ul className="mt-1 space-y-0.5">
                    {item.contacts.emails.map((email, i) => (
                      <li key={i}>
                        <a
                          href={`mailto:${email}`}
                          className="text-[var(--accent)] underline hover:no-underline"
                        >
                          {email}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.contacts.phones && item.contacts.phones.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-[var(--fg-muted)]">Phone</p>
                  <ul className="mt-1 space-y-0.5">
                    {item.contacts.phones.map((phone, i) => (
                      <li key={i}>
                        <a
                          href={`tel:${phone.replace(/\D/g, '')}`}
                          className="text-[var(--accent)] underline hover:no-underline"
                        >
                          {phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.contacts.addresses && item.contacts.addresses.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-[var(--fg-muted)]">Address</p>
                  <ul className="mt-1 space-y-0.5">
                    {item.contacts.addresses.map((addr, i) => (
                      <li key={i}>{addr}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.contacts.usernames && item.contacts.usernames.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--fg-muted)]">Usernames</p>
                  <ul className="mt-1 space-y-0.5">
                    {item.contacts.usernames.map((u, i) => (
                      <li key={i}>
                        <span className="text-[var(--fg-muted)]">{u.platform}:</span>{' '}
                        {u.username}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="flex items-center gap-2">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleEditValue}
              onChange={(e) => setTitleEditValue(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') {
                  setEditingTitle(false);
                  setTitleEditValue('');
                }
              }}
              className="filter-input flex-1 px-2 py-1 text-xl font-semibold"
            />
          ) : (
            <h1 className="text-xl font-semibold text-[var(--fg-default)]">
              {getItemDisplayTitle(item)}
            </h1>
          )}
          {!editingTitle && (
            <button
              type="button"
              onClick={startEditTitle}
              className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg-default)]"
              title="Edit title"
            >
              Edit
            </button>
          )}
        </div>

        {/* Tags under title */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {item.tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--draft-muted)] pl-2 pr-1 py-0.5 text-xs text-[var(--fg-muted)]"
            >
              <Link
                href={`/library?tag=${encodeURIComponent(tag)}`}
                className="text-[var(--accent)] hover:underline"
              >
                {tag}
              </Link>
              <button
                type="button"
                onClick={(e) => handleRemoveTag(tag, e)}
                className="rounded p-0.5 hover:bg-[var(--bg-inset)]"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <div className="relative">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onFocus={() => tagInput.trim() && setTagDropdownOpen(true)}
              onBlur={() => setTimeout(() => setTagDropdownOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = tagInput.trim();
                  if (val) handleAddTag(val);
                }
              }}
              placeholder="Add tag…"
              className="w-28 rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] px-2 py-0.5 text-xs text-[var(--fg-default)] placeholder:text-[var(--fg-muted)]"
            />
            {tagDropdownOpen && (
              <ul className="absolute left-0 top-full z-10 mt-1 max-h-40 w-48 overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] py-1 shadow-lg">
                {tagSuggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className="w-full px-2 py-1 text-left text-xs text-[var(--fg-default)] hover:bg-[var(--bg-inset)]"
                      onMouseDown={(e) => { e.preventDefault(); handleAddTag(s); }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
                {tagInput.trim() && !item?.tags?.includes(tagInput.trim().toLowerCase()) && (
                  <li>
                    <button
                      type="button"
                      className="w-full px-2 py-1 text-left text-xs text-[var(--accent)] hover:bg-[var(--bg-inset)]"
                      onMouseDown={(e) => { e.preventDefault(); handleAddTag(tagInput.trim()); }}
                    >
                      Add &ldquo;{tagInput.trim()}&rdquo;
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
              item.status === 'failed'
                ? 'bg-[var(--danger-muted)] text-[var(--danger)]'
                : item.status === 'enriched'
                  ? 'bg-[var(--success-muted)] text-[var(--success)]'
                  : item.status === 'extracted'
                    ? 'bg-[var(--bg-inset)] text-[var(--fg-muted)]'
                    : 'bg-[var(--draft-muted)] text-[var(--fg-muted)]'
            }`}
          >
            {item.status}
          </span>
          <CoverageBadge item={item} />
          <CollectionPicker
            itemId={item.id}
            collectionIds={item.collection_ids ?? []}
            collections={collections}
            onUpdate={fetchItem}
          />
          <span className="text-[var(--fg-muted)]">{item.source_type}</span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline hover:no-underline"
            >
              Open URL
            </a>
          )}
        </div>

        {/* Processing timeline */}
        <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-3 text-xs">
          <p className="font-medium text-[var(--fg-default)]">Processing</p>
          <ul className="mt-2 space-y-1 text-[var(--fg-muted)]">
            <li>
              Captured — {new Date(item.created_at).toLocaleString()}
            </li>
            {(item.extracted_at || item.status === 'extracted' || item.status === 'enriched') && (
              <li>
                Extracted — {item.extracted_at ? new Date(item.extracted_at).toLocaleString() : '—'}
              </li>
            )}
            {(item.enriched_at || item.status === 'enriched') && (
              <li>
                Enriched — {item.enriched_at ? new Date(item.enriched_at).toLocaleString() : '—'}
              </li>
            )}
          </ul>
        </div>

        {/* Cite panel */}
        <section className="mt-6">
          <h2 className="text-sm font-medium text-[var(--fg-default)]">Cite</h2>
          <div className="mt-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4">
            <label className="block text-xs font-medium text-[var(--fg-muted)]">
              Accessed on
            </label>
            <input
              type="date"
              value={citationAccessedOn}
              onChange={(e) => setCitationAccessedOn(e.target.value.slice(0, 10))}
              className="filter-input mt-1 px-2 py-1.5"
            />
            {citationsLoading && (
              <p className="mt-3 text-xs text-[var(--fg-muted)]">Loading citations…</p>
            )}
            {!citationsLoading && citations && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-medium text-[var(--fg-muted)]">APA 7</p>
                  <p className="mt-1 text-sm text-[var(--fg-default)]">{citations.apa}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(citations!.apa);
                        showToast('Copied', 'success');
                      } catch {
                        showToast('Copy failed', 'error');
                      }
                    }}
                    className="mt-1 rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-2 py-0.5 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-inset)]"
                  >
                    Copy citation
                  </button>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--fg-muted)]">MLA 9</p>
                  <p className="mt-1 text-sm text-[var(--fg-default)]">{citations.mla}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(citations!.mla);
                        showToast('Copied', 'success');
                      } catch {
                        showToast('Copy failed', 'error');
                      }
                    }}
                    className="mt-1 rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-2 py-0.5 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-inset)]"
                  >
                    Copy citation
                  </button>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--fg-muted)]">Chicago (Notes/Bibliography)</p>
                  <p className="mt-1 text-sm text-[var(--fg-default)]">{citations.chicago}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(citations!.chicago);
                        showToast('Copied', 'success');
                      } catch {
                        showToast('Copy failed', 'error');
                      }
                    }}
                    className="mt-1 rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-2 py-0.5 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-inset)]"
                  >
                    Copy citation
                  </button>
                </div>
              </div>
            )}
            {!citationsLoading && !citations && (
              <p className="mt-3 text-xs text-[var(--fg-muted)]">Could not load citations.</p>
            )}
          </div>
        </section>

        {item.status === 'enriched' && (
          <>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-muted)]">
              Regenerate:{' '}
              <button
                type="button"
                onClick={() => handleReEnrich('concise')}
                disabled={actionLoading}
                className="text-[var(--accent)] hover:underline disabled:opacity-50"
              >
                Re-enrich (concise)
              </button>
              <button
                type="button"
                onClick={() => handleReEnrich('analytical')}
                disabled={actionLoading}
                className="text-[var(--accent)] hover:underline disabled:opacity-50"
              >
                Re-enrich (analytical)
              </button>
              {(item.source_type === 'url' || item.source_type === 'file') && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={actionLoading}
                  className="text-[var(--accent)] hover:underline disabled:opacity-50"
                >
                  Re-extract
                </button>
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Re-enrich uses 3 credits (full) or 1 credit (tags only).
            </p>
          </>
        )}

        {item.status === 'failed' && item.error && (
          <div className="mt-6 rounded-lg border border-[var(--border-default)] bg-[var(--danger-muted)] p-4 text-sm text-[var(--danger)]">
            <p className="font-medium">Error</p>
            <p className="mt-1">{item.error}</p>
            {item.source_type === 'url' && (
              item.error?.includes('403') || item.error?.includes('401') || item.error?.includes('Could not extract text')
                ? (
                  <p className="mt-2 text-[var(--fg-default)]">
                    This may be paywalled or restricted. <Link href="/new" className="text-[var(--accent)] underline hover:no-underline">Try pasting the content</Link> instead.
                  </p>
                )
                : (
                  <p className="mt-2 text-[var(--fg-default)]">
                    Try pasting the content manually on <Link href="/new" className="text-[var(--accent)] underline hover:no-underline">New item</Link>, or retry later.
                  </p>
                )
            )}
            {item.source_type === 'file' && (
              <p className="mt-2 text-[var(--fg-default)]">
                Try re-uploading the file or pasting the content on <Link href="/new" className="text-[var(--accent)] underline hover:no-underline">New item</Link>.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {(item.source_type === 'url' || item.source_type === 'file') && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={actionLoading}
                  className="rounded bg-[var(--btn-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
                >
                  Re-extract
                </button>
              )}
              {item.source_type === 'paste' && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={actionLoading}
                  className="rounded bg-[var(--btn-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => handleReEnrich('concise')}
                disabled={actionLoading}
                className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-1.5 text-xs font-medium text-[var(--fg-default)] hover:bg-[var(--bg-inset)] disabled:opacity-50"
              >
                Re-enrich (concise)
              </button>
              <button
                type="button"
                onClick={() => handleReEnrich('analytical')}
                disabled={actionLoading}
                className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-1.5 text-xs font-medium text-[var(--fg-default)] hover:bg-[var(--bg-inset)] disabled:opacity-50"
              >
                Re-enrich (analytical)
              </button>
              <button
                type="button"
                onClick={() => handleReEnrich()}
                disabled={actionLoading}
                className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-1.5 text-xs font-medium text-[var(--fg-default)] hover:bg-[var(--bg-inset)] disabled:opacity-50"
              >
                Re-enrich
              </button>
            </div>
          </div>
        )}

        {item.status === 'enriched' && item.error === INSUFFICIENT_TEXT_MESSAGE && (
          <div className="mt-6 rounded-lg border border-[var(--border-default)] bg-[var(--accent-muted)] p-4 text-sm text-[var(--fg-default)]">
            <p className="font-medium">Notice</p>
            <p className="mt-1">{INSUFFICIENT_TEXT_MESSAGE}</p>
          </div>
        )}

        {item.status === 'enriched' && (
          <OnboardingHighlight />
        )}

        {(item.abstract || (item.bullets && item.bullets.length > 0)) ? (
          <section className="mt-6">
            <h2 className="text-sm font-medium text-[var(--fg-default)]">Summary</h2>
            <div className="mt-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--fg-default)]">
              {item.abstract && <p className="mb-3">{item.abstract}</p>}
              {item.bullets && item.bullets.length > 0 && (
                <ul className="space-y-2">
                  {item.bullets.map((b, i) => (
                    <li key={i} className="flex items-start justify-between gap-2">
                      <span className="flex-1">{b}</span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => copyWithFeedback(b, false)}
                          className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-2 py-0.5 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-inset)]"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => copyWithFeedback(b, true)}
                          className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-2 py-0.5 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-inset)]"
                        >
                          Copy + citation
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : item.status === 'enriched' && (
          <section className="mt-6">
            <h2 className="text-sm font-medium text-[var(--fg-default)]">Summary</h2>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">Not enriched yet.</p>
          </section>
        )}

        {item.quotes && item.quotes.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-medium text-[var(--fg-default)]">Quotes</h2>
            <ul className="mt-2 space-y-3">
              {item.quotes.map((q) => (
                <li key={q.id} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <blockquote
                      className="flex-1 cursor-pointer text-[var(--fg-default)] hover:underline"
                      onClick={() => handleQuoteClick(q.quote)}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuoteClick(q.quote)}
                      role="button"
                      tabIndex={0}
                    >
                      &ldquo;{q.quote}&rdquo;
                    </blockquote>
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => copyWithFeedback(`"${q.quote}"`, false)}
                        className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-2 py-0.5 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-inset)]"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => copyWithFeedback(`"${q.quote}"`, true)}
                        className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-2 py-0.5 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-inset)]"
                      >
                        Copy + citation
                      </button>
                    </span>
                  </div>
                  {q.why_it_matters && (
                    <p className="mt-1 text-[var(--fg-muted)]">{q.why_it_matters}</p>
                  )}
                  {quoteNotFound === q.quote && (
                    <p className="mt-1 text-xs text-[var(--fg-muted)]">Could not locate quote in text</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6" ref={sourceRef}>
          <button
            type="button"
            onClick={() => setSourceExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="flex w-full items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] px-4 py-2 text-left text-sm font-medium text-[var(--fg-default)]"
          >
            <span>Source text</span>
            <span>{isExpanded ? '−' : '+'}</span>
          </button>
          {isExpanded && (
            <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-t-0 border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--fg-default)] whitespace-pre-wrap">
              {content ? renderSourceWithHighlight(content) : 'No content yet. Item may still be processing.'}
            </div>
          )}
        </section>

        <div className="mt-8 border-t border-[var(--border-default)] pt-6">
          <button
            type="button"
            onClick={handleDelete}
            disabled={actionLoading}
            className="text-sm text-[var(--danger)] hover:underline disabled:opacity-50"
          >
            Delete item
          </button>
        </div>

        {screenshotFullscreen && item.thumbnail_url && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Screenshot fullscreen"
            onClick={() => setScreenshotFullscreen(false)}
          >
            <div
              className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={item.thumbnail_url}
                alt="Screenshot"
                className="max-h-[85vh] max-w-full rounded object-contain"
              />
              <div className="flex items-center gap-2">
                <a
                  href={item.thumbnail_url}
                  download="screenshot.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-1.5 text-sm font-medium text-[var(--fg-default)] hover:bg-[var(--bg-inset)]"
                >
                  Download image
                </a>
                <button
                  type="button"
                  onClick={() => setScreenshotFullscreen(false)}
                  className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-1.5 text-sm font-medium text-[var(--fg-default)] hover:bg-[var(--bg-inset)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </AppShell>
  );
}

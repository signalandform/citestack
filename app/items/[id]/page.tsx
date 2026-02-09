'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/app/components/app-shell';
import { Toast } from '@/app/components/toast';

type Quote = { id: string; quote: string; why_it_matters: string | null };
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
};

export default function ItemDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function formatCitation(): string {
    if (!item) return '';
    if (item.source_type === 'url') {
      const label = item.title || item.domain || 'Source';
      return `(Source: ${label}${item.url ? `, ${item.url}` : ''})`;
    }
    if (item.source_type === 'file' && item.original_filename) {
      return `(Source: ${item.original_filename})`;
    }
    return '(Source: note)';
  }

  async function copyWithFeedback(text: string, withCitation: boolean) {
    const final = withCitation ? `${text}\n${formatCitation()}` : text;
    try {
      await navigator.clipboard.writeText(final);
      setToast(withCitation ? 'Copied with citation' : 'Copied');
    } catch {
      setToast('Copy failed');
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

  async function handleRetry() {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/items/${id}/retry`, { method: 'POST' });
      await res.json();
      fetchItem();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReEnrich() {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/items/${id}/re-enrich`, { method: 'POST' });
      await res.json();
      fetchItem();
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
              <p>{item.domain || item.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</p>
              <p className="mt-0.5 font-medium text-[var(--fg-default)]">{item.title || 'Untitled'}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">{item.url}</p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[var(--accent)] underline hover:no-underline"
              >
                Open source
              </a>
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

        <h1 className="text-xl font-semibold text-[var(--fg-default)]">
          {item.title || item.original_filename || item.domain || item.id.slice(0, 8) + '…'}
        </h1>

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

        {item.status === 'failed' && item.error && (
          <div className="mt-6 rounded-lg border border-[var(--border-default)] bg-[var(--danger-muted)] p-4 text-sm text-[var(--danger)]">
            <p className="font-medium">Error</p>
            <p className="mt-1">{item.error}</p>
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
                onClick={handleReEnrich}
                disabled={actionLoading}
                className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-1.5 text-xs font-medium text-[var(--fg-default)] hover:bg-[var(--bg-inset)] disabled:opacity-50"
              >
                Re-enrich
              </button>
            </div>
          </div>
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
                    <blockquote className="flex-1 text-[var(--fg-default)]">&ldquo;{q.quote}&rdquo;</blockquote>
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
                </li>
              ))}
            </ul>
          </section>
        )}

        {item.tags && item.tags.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-medium text-[var(--fg-default)]">Tags</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-[var(--draft-muted)] px-2 py-0.5 text-xs text-[var(--fg-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-medium text-[var(--fg-default)]">Content</h2>
          <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--fg-default)] whitespace-pre-wrap">
            {content ? content : 'No content yet. Item may still be processing.'}
          </div>
        </section>

        {toast && (
          <Toast message={toast} onDismiss={() => setToast(null)} />
        )}
      </main>
    </AppShell>
  );
}

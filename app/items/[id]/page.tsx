'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/app/components/app-shell';

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
  created_at: string;
  updated_at: string;
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
          <p className="text-sm text-gray-500">Loading…</p>
        </main>
      </AppShell>
    );
  }

  if (error && !item) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl p-6">
          <p className="text-sm text-red-600">{error}</p>
          <p className="mt-4">
            <Link href="/library" className="text-sm text-gray-600 underline hover:text-gray-900">
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
          <Link href="/library" className="text-sm text-gray-600 underline hover:text-gray-900">
            Back to Library
          </Link>
        </p>

        <h1 className="text-xl font-semibold text-gray-900">
          {item.title || item.original_filename || item.domain || item.id.slice(0, 8) + '…'}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              item.status === 'failed'
                ? 'bg-red-100 text-red-800'
                : item.status === 'enriched'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
            }`}
          >
            {item.status}
          </span>
          <span className="text-gray-500">{item.source_type}</span>
          <span className="text-gray-500">{new Date(item.created_at).toLocaleDateString()}</span>
          {item.updated_at && item.updated_at !== item.created_at && (
            <span className="text-gray-500">Updated {new Date(item.updated_at).toLocaleDateString()}</span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 underline hover:text-gray-900"
            >
              Open URL
            </a>
          )}
          {item.original_filename && (
            <span className="text-gray-500">File: {item.original_filename}</span>
          )}
        </div>

        {item.status === 'failed' && item.error && (
          <div className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">Error</p>
            <p className="mt-1">{item.error}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={actionLoading}
                className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={handleReEnrich}
                disabled={actionLoading}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Re-enrich
              </button>
            </div>
          </div>
        )}

        {(item.abstract || (item.bullets && item.bullets.length > 0)) ? (
          <section className="mt-6">
            <h2 className="text-sm font-medium text-gray-700">Summary</h2>
            <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
              {item.abstract && <p className="mb-3">{item.abstract}</p>}
              {item.bullets && item.bullets.length > 0 && (
                <ul className="list-disc list-inside space-y-1">
                  {item.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : item.status === 'enriched' && (
          <section className="mt-6">
            <h2 className="text-sm font-medium text-gray-700">Summary</h2>
            <p className="mt-2 text-sm text-gray-500">Not enriched yet.</p>
          </section>
        )}

        {item.quotes && item.quotes.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-medium text-gray-700">Quotes</h2>
            <ul className="mt-2 space-y-3">
              {item.quotes.map((q) => (
                <li key={q.id} className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                  <blockquote className="text-gray-800">&ldquo;{q.quote}&rdquo;</blockquote>
                  {q.why_it_matters && (
                    <p className="mt-1 text-gray-600">{q.why_it_matters}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {item.tags && item.tags.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-medium text-gray-700">Tags</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-medium text-gray-700">Content</h2>
          <div className="mt-2 max-h-96 overflow-auto rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 whitespace-pre-wrap">
            {content ? content : 'No content yet. Item may still be processing.'}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

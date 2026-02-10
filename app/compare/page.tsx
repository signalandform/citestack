'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/app/components/app-shell';

type ComparisonRow = {
  id: string;
  item_ids: string[];
  created_at: string;
};

export default function CompareListPage() {
  const [comparisons, setComparisons] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComparisons = useCallback(() => {
    fetch('/api/compare')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => setComparisons(data.comparisons ?? []))
      .catch(() => setError('Could not load comparisons'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchComparisons();
  }, [fetchComparisons]);

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold text-[var(--fg-default)]">Comparisons</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Run and view comparisons of 2–5 items.
        </p>
        <Link
          href="/compare/new"
          className="mt-4 inline-block rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)]"
        >
          New comparison
        </Link>

        {loading ? (
          <p className="mt-6 text-sm text-[var(--fg-muted)]">Loading…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-[var(--danger)]">{error}</p>
        ) : comparisons.length === 0 ? (
          <div className="mt-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--fg-muted)]">
            <p>No comparisons yet. Start a new comparison to compare 2–5 items.</p>
            <Link
              href="/compare/new"
              className="mt-3 inline-block rounded bg-[var(--btn-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)]"
            >
              New comparison
            </Link>
            <Link href="/library" className="ml-3 text-sm text-[var(--accent)] underline hover:no-underline">
              Go to Library
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {comparisons.map((c) => (
              <Link
                key={c.id}
                href={`/compare/${c.id}`}
                className="block rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm transition-colors hover:bg-[var(--draft-muted)]"
              >
                <span className="font-medium text-[var(--fg-default)]">
                  {c.item_ids?.length ?? 0} items compared
                </span>
                <span className="ml-2 text-[var(--fg-muted)]">
                  — {new Date(c.created_at).toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

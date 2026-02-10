'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/app/components/app-shell';
import { useToast } from '@/app/contexts/toast';
import { getItemDisplayTitle } from '@/lib/item-display';

type Item = {
  id: string;
  title: string | null;
  source_type: string;
  domain?: string | null;
  original_filename?: string | null;
  status?: string;
};

export default function NewComparisonPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchItems = useCallback(() => {
    setLoading(true);
    fetch('/api/items')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canCompare = selectedIds.size >= 2 && selectedIds.size <= 5;
  const compareCreditCost = canCompare ? 5 + Math.max(0, selectedIds.size - 2) : 0;

  async function handleCompare() {
    if (!canCompare || comparing) return;
    setComparing(true);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: [...selectedIds] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.message ?? data.error ?? 'Comparison failed';
        showToast(message, 'error');
        return;
      }
      showToast('Comparison complete', 'success');
      router.push(`/compare/${data.id}`);
    } catch {
      showToast('Comparison failed', 'error');
    } finally {
      setComparing(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-6">
        <Link
          href="/compare"
          className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg-default)]"
        >
          Back to Comparisons
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-[var(--fg-default)]">New comparison</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Select 2–5 items to compare.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-[var(--fg-muted)]">Loading items…</p>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--fg-muted)]">
            No items in your library. Add items from the Library first.
            <Link href="/library" className="ml-1 font-medium text-[var(--accent)] underline hover:no-underline">
              Go to Library
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCompare}
                disabled={!canCompare || comparing}
                className="rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
              >
                {comparing ? 'Comparing…' : `Compare (${selectedIds.size} selected)`}
              </button>
              {canCompare && (
                <span className="text-sm text-[var(--fg-muted)]">
                  This comparison will use {compareCreditCost} credits.
                </span>
              )}
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg-default)]"
                >
                  Clear
                </button>
              )}
            </div>
            <ul className="mt-4 space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded border-[var(--border-default)]"
                    aria-label={`Select ${getItemDisplayTitle(item)}`}
                  />
                  <span className="min-w-0 flex-1 font-medium text-[var(--fg-default)]">
                    {getItemDisplayTitle(item)}
                  </span>
                  <span className="text-xs text-[var(--fg-muted)]">
                    {item.source_type} · {item.status ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </AppShell>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/app/components/app-shell';

type Item = {
  id: string;
  title: string | null;
  source_type: string;
  status: string;
  created_at: string;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function LibraryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery.trim(), 300);

  useEffect(() => {
    setLoading(true);
    setError('');
    if (debouncedQuery) {
      fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to search');
          return res.json();
        })
        .then((data) => setItems(data.items ?? []))
        .catch(() => setError('Could not search'))
        .finally(() => setLoading(false));
    } else {
      fetch('/api/items')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load');
          return res.json();
        })
        .then((data) => setItems(data.items ?? []))
        .catch(() => setError('Could not load library'))
        .finally(() => setLoading(false));
    }
  }, [debouncedQuery]);

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold">Library</h1>
        <p className="mt-2 text-sm text-gray-600">
          Your captured items. Add content from New item. Each item is processed in the background: captured → extracted → enriched.
        </p>

        <div className="mt-4">
          <input
            type="search"
            placeholder="Search by title or summary…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {loading && <p className="mt-4 text-sm text-gray-500">Loading…</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            {debouncedQuery
              ? 'No matching items.'
              : <>No items yet. <Link href="/new" className="font-medium text-gray-900 underline">Go to New item</Link> to add your first URL, paste, or file.</>}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="mt-6 space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/items/${item.id}`}
                  className="block rounded border border-gray-200 bg-gray-50 p-3 text-sm transition-colors hover:border-gray-300 hover:bg-gray-100"
                >
                  <div className="font-medium text-gray-900">
                    {item.title || item.id.slice(0, 8) + '…'}
                  </div>
                  <div className="mt-1 flex gap-2 text-xs text-gray-500">
                    <span>{item.source_type}</span>
                    <span>{item.status}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

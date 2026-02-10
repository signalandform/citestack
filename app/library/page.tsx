'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/app/components/app-shell';
import { CollectionPicker } from '@/app/components/collection-picker';
import { CoverageBadge } from '@/app/components/coverage-badge';
import { OnboardingBanner } from '@/app/components/onboarding';
import { useToast } from '@/app/contexts/toast';
import { getItemDisplayTitle } from '@/lib/item-display';

type Item = {
  id: string;
  title: string | null;
  source_type: string;
  domain?: string | null;
  status: string;
  created_at: string;
  last_saved_at?: string | null;
  abstract?: string | null;
  summary?: string | null;
  tags?: string[];
  bullets?: unknown[] | null;
  cleaned_text_length?: number | null;
  quotes_count?: number;
  collection_ids?: string[];
};

type Collection = { id: string; name: string; created_at: string };

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function buildParams(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tagFromUrl = searchParams.get('tag') ?? undefined;
  const collectionFromUrl = searchParams.get('collection') ?? undefined;

  const [items, setItems] = useState<Item[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'recent_saved'>('newest');
  const [typeFilter, setTypeFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState(collectionFromUrl ?? '');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  async function handleExport(format: 'bibtex' | 'ris' | 'csl-json') {
    setExportDropdownOpen(false);
    if (selectedIds.size === 0) return;
    setExporting(true);
    const accessedAt = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch('/api/citations/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          itemIds: Array.from(selectedIds),
          accessedAt,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const ext = format === 'bibtex' ? '.bib' : format === 'ris' ? '.ris' : '.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `citestack-export${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export downloaded', 'success');
      setSelectedIds(new Set());
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }
  const debouncedQuery = useDebounce(searchQuery.trim(), 300);
  const debouncedDomain = useDebounce(domainFilter.trim(), 300);

  const tagFilter = tagFromUrl || undefined;
  const effectiveCollectionFilter = collectionFilter || undefined;

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
    setCollectionFilter(collectionFromUrl ?? '');
  }, [collectionFromUrl]);

  const fetchUrl = useMemo(() => {
    const base = debouncedQuery ? '/api/search' : '/api/items';
    const params: Record<string, string> = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
    if (sortOrder === 'recent_saved' && !debouncedQuery) params.sort = 'recent_saved';
    if (typeFilter) params.source_type = typeFilter;
    if (debouncedDomain) params.domain = debouncedDomain;
    if (tagFilter) params.tag = tagFilter;
    if (effectiveCollectionFilter) params.collection = effectiveCollectionFilter;
    return `${base}${buildParams(params)}`;
  }, [debouncedQuery, statusFilter, sortOrder, typeFilter, debouncedDomain, tagFilter, effectiveCollectionFilter]);

  const fetchItems = useCallback(() => {
    setLoading(true);
    setError('');
    fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error(debouncedQuery ? 'Failed to search' : 'Failed to load');
        return res.json();
      })
      .then((data) => setItems(data.items ?? []))
      .catch(() => setError(debouncedQuery ? 'Could not search' : 'Could not load library'))
      .finally(() => setLoading(false));
  }, [fetchUrl, debouncedQuery]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const favoritesCollectionId = collections.find((c) => c.name === 'Favorites')?.id;

  async function toggleFavorite(itemId: string, isInFavorites: boolean) {
    if (!favoritesCollectionId) return;
    try {
      if (isInFavorites) {
        await fetch(
          `/api/collections/${favoritesCollectionId}/items?itemId=${encodeURIComponent(itemId)}`,
          { method: 'DELETE' }
        );
        showToast('Removed from Favorites', 'success');
      } else {
        await fetch(`/api/collections/${favoritesCollectionId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId }),
        });
        showToast('Added to Favorites', 'success');
      }
      fetchItems();
    } catch {
      showToast('Failed to update', 'error');
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold text-[var(--fg-default)]">Library</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Your captured items. Add content from New item. Each item is processed in the background: captured → extracted → enriched.
        </p>

        <div className="mt-4">
          <OnboardingBanner variant="library" />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <input
            type="search"
            placeholder="Search by title or summary…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="filter-input w-full px-3 py-2"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select px-2 py-1.5"
            >
              <option value="">Status: All</option>
              <option value="processing">Processing</option>
              <option value="enriched">Enriched</option>
              <option value="failed">Failed</option>
            </select>
            {!debouncedQuery && (
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'recent_saved')}
                className="filter-select px-2 py-1.5"
              >
                <option value="newest">Newest first</option>
                <option value="recent_saved">Recently saved first</option>
              </select>
            )}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="filter-select px-2 py-1.5"
            >
              <option value="">Type: All</option>
              <option value="url">URL</option>
              <option value="paste">Paste</option>
              <option value="file">File</option>
            </select>
            <input
              type="text"
              placeholder="Domain…"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="filter-input w-28 px-2 py-1.5"
            />
            <select
              value={collectionFilter}
              onChange={(e) => {
                const v = e.target.value;
                setCollectionFilter(v);
                const params = new URLSearchParams(searchParams.toString());
                if (v) params.set('collection', v);
                else params.delete('collection');
                router.push(`/library${params.toString() ? '?' + params : ''}`);
              }}
              className="filter-select px-2 py-1.5"
            >
              <option value="">Collection: All</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New collection…"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newCollectionName.trim()) {
                      setCreatingCollection(true);
                      fetch('/api/collections', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: newCollectionName.trim() }),
                      })
                        .then((r) => r.json())
                        .then((data) => {
                          if (data.id) {
                            showToast('Collection created', 'success');
                            setNewCollectionName('');
                            fetchCollections();
                            setCollectionFilter(data.id);
                            router.push(`/library?collection=${data.id}`);
                          }
                        })
                        .finally(() => setCreatingCollection(false));
                    }
                  }
                }}
                className="filter-input w-32 px-2 py-1.5"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newCollectionName.trim()) return;
                  setCreatingCollection(true);
                  fetch('/api/collections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newCollectionName.trim() }),
                  })
                    .then((r) => r.json())
                    .then((data) => {
                      if (data.id) {
                        showToast('Collection created', 'success');
                        setNewCollectionName('');
                        fetchCollections();
                        setCollectionFilter(data.id);
                        router.push(`/library?collection=${data.id}`);
                      }
                    })
                    .finally(() => setCreatingCollection(false));
                }}
                disabled={!newCollectionName.trim() || creatingCollection}
                className="rounded bg-[var(--btn-primary)] px-2 py-1.5 text-xs font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
              >
                Create
              </button>
            </div>
            {tagFilter && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--draft-muted)] pl-2 pr-1 py-0.5 text-xs text-[var(--fg-muted)]">
                Tag: {tagFilter}
                <Link
                  href="/library"
                  className="rounded p-0.5 hover:bg-[var(--bg-inset)]"
                  aria-label="Clear tag filter"
                >
                  ×
                </Link>
              </span>
            )}
            {effectiveCollectionFilter && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--draft-muted)] pl-2 pr-1 py-0.5 text-xs text-[var(--fg-muted)]">
                Collection: {collections.find((c) => c.id === effectiveCollectionFilter)?.name ?? 'Selected'}
                <button
                  type="button"
                  onClick={() => {
                    setCollectionFilter('');
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('collection');
                    router.push(`/library${params.toString() ? '?' + params : ''}`);
                  }}
                  className="rounded p-0.5 hover:bg-[var(--bg-inset)]"
                  aria-label="Clear collection filter"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>

        {!loading && !error && items.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              {selectedIds.size === items.length ? 'Clear selection' : 'Select all'}
            </button>
            {selectedIds.size > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportDropdownOpen((v) => !v)}
                  disabled={exporting}
                  className="filter-select inline-flex items-center gap-1 px-2 py-1.5 text-sm"
                  aria-haspopup="listbox"
                  aria-expanded={exportDropdownOpen}
                >
                  Export ({selectedIds.size})…
                </button>
                {exportDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      aria-hidden="true"
                      onClick={() => setExportDropdownOpen(false)}
                    />
                    <ul
                      className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] py-1 shadow-lg"
                      role="listbox"
                    >
                      <li>
                        <button
                          type="button"
                          onClick={() => handleExport('bibtex')}
                          className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg-default)] hover:bg-[var(--bg-inset)]"
                        >
                          BibTeX (.bib)
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => handleExport('ris')}
                          className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg-default)] hover:bg-[var(--bg-inset)]"
                        >
                          RIS (.ris)
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => handleExport('csl-json')}
                          className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg-default)] hover:bg-[var(--bg-inset)]"
                        >
                          CSL-JSON (.json)
                        </button>
                      </li>
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {collections.length === 0 && !loading && (
          <p className="mt-2 text-xs text-[var(--fg-muted)]">
            Create a collection above to group items into lightweight projects.
          </p>
        )}

        {loading && <p className="mt-4 text-sm text-[var(--fg-muted)]">Loading…</p>}
        {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <div className="mt-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-6 text-center">
            {debouncedQuery || effectiveCollectionFilter ? (
              <p className="text-sm text-[var(--fg-muted)]">No matching items. Try adjusting your filters.</p>
            ) : (
              <>
                <p className="text-base font-medium text-[var(--fg-default)]">Your library is empty</p>
                <p className="mt-2 text-sm text-[var(--fg-muted)]">
                  Add URLs, paste text, or upload files. Citestack will extract and enrich them automatically.
                </p>
                <Link
                  href="/new"
                  className="mt-4 inline-block rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)]"
                >
                  Add your first item
                </Link>
              </>
            )}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="mt-6 space-y-3">
            {items.map((item) => {
              const snippet = (item.abstract ?? item.summary ?? '').trim();
              const snippetDisplay = snippet
                ? snippet.length > 150
                  ? snippet.slice(0, 150).trim() + '…'
                  : snippet
                : null;
              const isInFavorites = Boolean(favoritesCollectionId && item.collection_ids?.includes(favoritesCollectionId));

              const isSelected = selectedIds.has(item.id);
              return (
                <li key={item.id}>
                  <div className="relative flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] transition-colors hover:border-[var(--border-default)] hover:bg-[var(--draft-muted)]">
                    <div
                      className="flex shrink-0 items-start pt-3 pl-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${getItemDisplayTitle(item)}`}
                        className="h-4 w-4 rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)]"
                      />
                    </div>
                    {favoritesCollectionId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(item.id, isInFavorites);
                        }}
                        className="absolute top-3 right-3 z-10 rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-default)] hover:text-[var(--accent)]"
                        title={isInFavorites ? 'Remove from Favorites' : 'Add to Favorites'}
                        aria-label={isInFavorites ? 'Remove from Favorites' : 'Add to Favorites'}
                      >
                        {isInFavorites ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                            <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                        )}
                      </button>
                    )}
                    <Link
                      href={`/items/${item.id}`}
                      className="min-w-0 flex-1 block p-3 pr-10 text-sm"
                    >
                      <div className="font-medium text-[var(--fg-default)]">
                        {getItemDisplayTitle(item)}
                      </div>
                      {snippetDisplay && (
                        <p className="mt-1 text-[var(--fg-muted)]">{snippetDisplay}</p>
                      )}
                      {item.status !== 'enriched' && !snippetDisplay && (
                        <p className="mt-1 text-xs text-[var(--fg-muted)] opacity-70">Processing…</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {item.tags && item.tags.length > 0 && (
                          <span className="flex flex-wrap gap-1">
                            {item.tags.slice(0, 5).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md bg-[var(--draft-muted)] px-1.5 py-0.5 text-xs text-[var(--fg-muted)]"
                              >
                                {tag}
                              </span>
                            ))}
                            {item.tags.length > 5 && (
                              <span className="text-xs text-[var(--fg-muted)] opacity-70">+{item.tags.length - 5}</span>
                            )}
                          </span>
                        )}
                        <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
                          {item.last_saved_at &&
                            Date.now() - new Date(item.last_saved_at).getTime() < 5 * 60 * 1000 && (
                              <span className="rounded bg-[var(--success-muted)] px-1.5 py-0.5 text-[var(--success)]">
                                Just saved
                              </span>
                            )}
                          <CollectionPicker
                            itemId={item.id}
                            collectionIds={item.collection_ids ?? []}
                            collections={collections}
                            onUpdate={fetchItems}
                            compact
                          />
                          <CoverageBadge item={item} />
                          <span>{item.source_type}</span>
                          <span>{item.status}</span>
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        </span>
                      </div>
                    </Link>
                  </div>
                </li>
              );
            })}
            </ul>
        )}
      </main>
    </AppShell>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <main className="mx-auto max-w-2xl p-6">
          <h1 className="text-xl font-semibold text-[var(--fg-default)]">Library</h1>
          <p className="mt-4 text-sm text-[var(--fg-muted)]">Loading…</p>
        </main>
      </AppShell>
    }>
      <LibraryContent />
    </Suspense>
  );
}

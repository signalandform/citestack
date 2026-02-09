'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/app/contexts/toast';

type Collection = { id: string; name: string; created_at: string };

function navLinkClass(active: boolean) {
  return `rounded-md px-3 py-2 text-sm ${
    active
      ? 'font-medium text-[var(--fg-default)] bg-[var(--draft-muted)]'
      : 'text-[var(--fg-muted)] hover:bg-[var(--draft-muted)] hover:text-[var(--fg-default)]'
  }`;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const collectionId = pathname === '/library' ? searchParams.get('collection') ?? null : null;

  const fetchCollections = useCallback(() => {
    fetch('/api/collections')
      .then((r) => r.json())
      .then((data) => setCollections(data.collections ?? []))
      .catch(() => setCollections([]));
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  function handleCreateCollection() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          showToast('Collection created', 'success');
          setNewName('');
          fetchCollections();
          router.push(`/library?collection=${data.id}`);
        }
      })
      .finally(() => setCreating(false));
  }

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-inset)]">
      <nav className="flex flex-col gap-0.5 p-3">
        <Link href="/library" className="font-semibold text-[var(--fg-default)] hover:text-[var(--accent)] px-3 py-2">
          Citestack
        </Link>
        <Link href="/library" className={navLinkClass(pathname === '/library')}>
          Library
        </Link>
        <Link href="/new" className={navLinkClass(pathname === '/new')}>
          New item
        </Link>
      </nav>
      <div className="border-t border-[var(--border-default)] px-3 py-2">
        <p className="mb-2 px-3 text-xs font-medium text-[var(--fg-muted)]">Collections</p>
        <div className="flex flex-col gap-0.5">
          <Link
            href="/library"
            className={navLinkClass(pathname === '/library' && !collectionId)}
          >
            All
          </Link>
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/library?collection=${c.id}`}
              className={navLinkClass(collectionId === c.id)}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-auto border-t border-[var(--border-default)] p-3">
        <div className="mb-3 flex gap-1">
          <input
            type="text"
            placeholder="New collection…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
            className="filter-input flex-1 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={handleCreateCollection}
            disabled={!newName.trim() || creating}
            className="rounded bg-[var(--btn-primary)] px-2 py-1 text-xs font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--fg-muted)] hover:bg-[var(--draft-muted)] hover:text-[var(--fg-default)]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

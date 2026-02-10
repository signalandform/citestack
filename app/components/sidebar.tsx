'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTheme, type ThemeValue } from '@/app/contexts/theme';

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
  const [collections, setCollections] = useState<Collection[]>([]);
  const [credits, setCredits] = useState<{ balance: number; resetAt: string } | null>(null);
  const { theme, setTheme, effectiveTheme } = useTheme();

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

  const fetchCredits = useCallback(() => {
    fetch('/api/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setCredits({ balance: data.balance, resetAt: data.resetAt }))
      .catch(() => setCredits(null));
  }, []);
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-inset)]">
      <nav className="flex flex-col gap-0.5 p-3">
        <Link href="/library" className="flex items-center gap-2 px-3 py-2 text-[var(--fg-default)] hover:opacity-80">
          <Image
            src={effectiveTheme === 'dark' ? '/logowhite.png' : '/logo.png'}
            alt="Citestack"
            width={28}
            height={28}
            className="shrink-0"
          />
          <span className="font-semibold">Citestack</span>
        </Link>
        <Link href="/library" className={navLinkClass(pathname === '/library')}>
          Library
        </Link>
        <Link href="/new" className={navLinkClass(pathname === '/new')}>
          New item
        </Link>
        <Link href="/queue" className={navLinkClass(pathname === '/queue')}>
          Process queue
        </Link>
        <Link href="/compare" className={navLinkClass(pathname === '/compare' || pathname.startsWith('/compare/'))}>
          Comparisons
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
      <div className="border-t border-[var(--border-default)] px-3 py-2">
        <p className="mb-2 px-3 text-xs font-medium text-[var(--fg-muted)]">Credits</p>
        <Link
          href="/credits"
          className="block rounded-md px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--draft-muted)] hover:text-[var(--fg-default)]"
        >
          {credits != null ? (
            <>
              <span className="font-medium text-[var(--fg-default)]">{credits.balance}</span>
              <span className="ml-1">credits</span>
              {credits.resetAt && (
                <span className="mt-1 block text-xs">
                  Resets {new Date(credits.resetAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </>
          ) : (
            '—'
          )}
        </Link>
      </div>
      <div className="border-t border-[var(--border-default)] px-3 py-2">
        <p className="mb-2 px-3 text-xs font-medium text-[var(--fg-muted)]">Appearance</p>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeValue)}
          className="filter-select px-2 py-1.5 mb-2 w-full"
          aria-label="Theme"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>
      <div className="border-t border-[var(--border-default)] px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <Link href="/account" className={navLinkClass(pathname === '/account')}>
            Account
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md px-3 py-2 text-left text-sm text-[var(--fg-muted)] hover:bg-[var(--draft-muted)] hover:text-[var(--fg-default)]"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;

      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        router.push('/new');
      }
      if (e.key === '/' && pathname === '/library') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[type="search"]');
        input?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div>
      <header className="border-b border-[var(--border-default)] bg-[var(--bg-default)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
          <Link href="/library" className="text-sm font-semibold text-[var(--fg-default)] hover:text-[var(--accent)]">
            Clerkbook
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/library" className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg-default)]">
              Library
            </Link>
            <Link href="/new" className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg-default)]">
              New item
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg-default)]"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Sidebar } from './sidebar';

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

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<aside className="w-[200px] shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-inset)]" />}>
        <Sidebar />
      </Suspense>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

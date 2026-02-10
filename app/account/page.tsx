'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/app/components/app-shell';

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      setLoading(false);
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold text-[var(--fg-default)]">Account</h1>
        <div className="mt-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--fg-default)]">
          {loading ? (
            <p className="text-[var(--fg-muted)]">Loading…</p>
          ) : (
            <>
              {email && (
                <p>
                  <span className="text-[var(--fg-muted)]">Email:</span>{' '}
                  <span className="font-medium">{email}</span>
                </p>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-4 rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2 text-sm font-medium text-[var(--fg-default)] hover:bg-[var(--draft-muted)]"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}

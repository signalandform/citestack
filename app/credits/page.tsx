'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/app/components/app-shell';

type LedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  job_id: string | null;
  item_id: string | null;
  created_at: string;
};

type CreditsData = {
  balance: number;
  resetAt: string;
  monthlyGrant: number;
  ledger: LedgerEntry[];
};

function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    enrich_item_full: 'Enrich (full)',
    enrich_item_tags_only: 'Enrich (tags only)',
    compare_items: 'Compare',
    monthly_grant: 'Monthly grant',
    admin_grant: 'Admin grant',
  };
  return labels[reason] ?? reason;
}

export default function CreditsPage() {
  const [data, setData] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/credits')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(setData)
      .catch(() => setError('Could not load credits'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold text-[var(--fg-default)]">Credits</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Credits are used for enrichment and comparisons. They reset monthly.
        </p>

        {loading && <p className="mt-6 text-sm text-[var(--fg-muted)]">Loading…</p>}
        {error && <p className="mt-6 text-sm text-[var(--danger)]">{error}</p>}

        {!loading && !error && data && (
          <>
            <div className="mt-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4">
              <p className="text-sm font-medium text-[var(--fg-default)]">
                Balance: <span className="text-lg">{data.balance}</span> credits
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Next reset: {new Date(data.resetAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Monthly grant: {data.monthlyGrant} credits
              </p>
            </div>

            <h2 className="mt-8 text-sm font-medium text-[var(--fg-default)]">Recent activity</h2>
            {data.ledger.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--fg-muted)]">No activity yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-3">
                {data.ledger.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-[var(--fg-default)]">
                      {reasonLabel(entry.reason)}
                    </span>
                    <span
                      className={
                        entry.delta >= 0
                          ? 'text-[var(--success)]'
                          : 'text-[var(--fg-muted)]'
                      }
                    >
                      {entry.delta >= 0 ? '+' : ''}{entry.delta}
                    </span>
                    <span className="w-full text-xs text-[var(--fg-muted)]">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

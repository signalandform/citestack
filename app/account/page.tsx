'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/app/components/app-shell';

type UsageLedgerEntry = {
  id: string;
  created_at: string;
  delta: number;
  reason: string;
};

type UsageData = {
  plan: string;
  credits_balance: number;
  monthly_grant: number;
  ledger: UsageLedgerEntry[];
};

function planDisplayName(plan: string): string {
  if (plan === 'pro') return 'Pro';
  if (plan === 'power') return 'Power';
  return 'Free';
}

function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    enrich_item_full: 'Enrich item',
    enrich_item_tags_only: 'Retag',
    compare_items: 'Compare',
    monthly_grant: 'Monthly credits',
    admin_grant: 'Admin grant',
    credit_pack: 'Credit pack',
  };
  return labels[reason] ?? reason;
}

function AccountUsageContent({ usage }: { usage: UsageData }) {
  const [activityOpen, setActivityOpen] = useState(false);
  const hasActivity = !!(usage.ledger?.length);

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[var(--fg-muted)]">Plan:</span>
        <span className="font-medium">{planDisplayName(usage.plan)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href="/account/billing"
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2 text-sm font-medium text-[var(--fg-default)] hover:bg-[var(--draft-muted)]"
        >
          Upgrade plan
        </Link>
        <Link
          href="/account/billing"
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2 text-sm font-medium text-[var(--fg-default)] hover:bg-[var(--draft-muted)]"
        >
          Buy credit pack
        </Link>
      </div>
      <p className="mt-4 text-2xl font-semibold text-[var(--fg-default)]">
        {Math.max(0, usage.credits_balance)} <span className="text-base font-normal text-[var(--fg-muted)]">credits</span>
      </p>
      <p className="mt-1 text-[var(--fg-muted)]">
        +{usage.monthly_grant} credits/month
      </p>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">
        Credits roll over • never expire
      </p>

      <h3 className="mt-6 text-sm font-medium text-[var(--fg-default)]">What costs credits?</h3>
      <ul className="mt-1 list-inside list-disc text-[var(--fg-muted)]">
        <li>Enrich (full) = 2 credits</li>
        <li>Retag = 1 credit</li>
        <li>Compare (2 / 3 / 4 / 5 items) = 6 / 7 / 8 / 9 credits</li>
      </ul>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => setActivityOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-transparent py-1 text-left text-sm font-medium text-[var(--fg-default)] hover:bg-[var(--bg-default)]"
          aria-expanded={activityOpen}
        >
          <span>Recent activity</span>
          <span className="text-[var(--fg-muted)]" aria-hidden>
            {activityOpen ? '▼' : '▶'}
          </span>
        </button>
        {activityOpen && (
          <div className="mt-2">
            {!hasActivity ? (
              <p className="text-sm text-[var(--fg-muted)]">No activity yet.</p>
            ) : (
              <ul className="space-y-1">
                {usage.ledger!.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-[var(--fg-default)]">{reasonLabel(entry.reason)}</span>
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
          </div>
        )}
      </div>
    </>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);

  const fetchUsage = useCallback(() => {
    setUsageLoading(true);
    setUsageError(null);
    fetch('/api/account/usage')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(setUsage)
      .catch(() => setUsageError('Could not load usage'))
      .finally(() => setUsageLoading(false));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

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

        <h2 className="mt-8 text-lg font-semibold text-[var(--fg-default)]">Billing & Usage</h2>
        <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--fg-default)]">
          {usageLoading ? (
            <p className="text-[var(--fg-muted)]">Loading…</p>
          ) : usageError ? (
            <p className="text-[var(--danger)]">{usageError}</p>
          ) : usage ? (
            <AccountUsageContent usage={usage} />
          ) : null}
        </div>

        <h2 className="mt-8 text-lg font-semibold text-[var(--fg-default)]">Contact support</h2>
        <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--fg-default)]">
          <p className="text-[var(--fg-muted)]">
            Need help? Email us at{' '}
            <a
              href="mailto:jack@signalandformllc.com"
              className="text-[var(--accent)] underline hover:no-underline"
            >
              jack@signalandformllc.com
            </a>
          </p>
        </div>
      </main>
    </AppShell>
  );
}

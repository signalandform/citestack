'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/app/components/app-shell';
import { useToast } from '@/app/contexts/toast';

type LoadingKey = 'pro' | 'power' | '5' | '9' | '19' | null;

async function startCheckout(body: { plan?: string; type?: string; pack?: string }): Promise<{ url?: string; error?: string; details?: string }> {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error ?? 'Checkout failed', details: data.details };
  }
  return { url: data.url };
}

export default function ComingSoonPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<LoadingKey>(null);

  const handlePlan = async (plan: 'pro' | 'power') => {
    setLoading(plan);
    try {
      const result = await startCheckout({ plan });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      showToast(result.details ?? result.error ?? 'Checkout failed', 'error');
    } catch {
      showToast('Checkout failed', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handlePack = async (pack: '5' | '9' | '19') => {
    setLoading(pack);
    try {
      const result = await startCheckout({ type: 'credit_pack', pack });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      showToast(result.details ?? result.error ?? 'Checkout failed', 'error');
    } catch {
      showToast('Checkout failed', 'error');
    } finally {
      setLoading(null);
    }
  };

  const buttonClass =
    'rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2 text-sm font-medium text-[var(--fg-default)] hover:bg-[var(--draft-muted)] disabled:opacity-50 disabled:pointer-events-none';

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold text-[var(--fg-default)]">Billing & credits</h1>

        <h2 className="mt-6 text-lg font-medium text-[var(--fg-default)]">Upgrade plan</h2>
        <div className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-1 min-w-[140px] flex-col gap-1">
              <span className="font-medium text-[var(--fg-default)]">Pro</span>
              <p className="text-sm text-[var(--fg-muted)]">200 credits/month</p>
              <button
                type="button"
                className={`mt-1 self-start ${buttonClass}`}
                disabled={loading !== null}
                onClick={() => handlePlan('pro')}
              >
                {loading === 'pro' ? 'Opening checkout…' : 'Subscribe Pro'}
              </button>
            </div>
            <div className="flex flex-1 min-w-[140px] flex-col gap-1">
              <span className="font-medium text-[var(--fg-default)]">Power</span>
              <p className="text-sm text-[var(--fg-muted)]">500 credits/month</p>
              <button
                type="button"
                className={`mt-1 self-start ${buttonClass}`}
                disabled={loading !== null}
                onClick={() => handlePlan('power')}
              >
                {loading === 'power' ? 'Opening checkout…' : 'Subscribe Power'}
              </button>
            </div>
          </div>
        </div>

        <h2 className="mt-6 text-lg font-medium text-[var(--fg-default)]">Buy credit pack</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">One-time purchase • credits never expire</p>
        <div className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-1 min-w-[100px] flex-col gap-1">
              <span className="font-medium text-[var(--fg-default)]">$5</span>
              <p className="text-sm text-[var(--fg-muted)]">120 credits (≈ 60 enriches)</p>
              <button
                type="button"
                className={`mt-1 self-start ${buttonClass}`}
                disabled={loading !== null}
                onClick={() => handlePack('5')}
              >
                {loading === '5' ? 'Opening checkout…' : 'Buy $5'}
              </button>
            </div>
            <div className="flex flex-1 min-w-[100px] flex-col gap-1">
              <span className="font-medium text-[var(--fg-default)]">$9</span>
              <p className="text-sm text-[var(--fg-muted)]">250 credits (≈ 125 enriches)</p>
              <button
                type="button"
                className={`mt-1 self-start ${buttonClass}`}
                disabled={loading !== null}
                onClick={() => handlePack('9')}
              >
                {loading === '9' ? 'Opening checkout…' : 'Buy $9'}
              </button>
            </div>
            <div className="flex flex-1 min-w-[100px] flex-col gap-1">
              <span className="font-medium text-[var(--fg-default)]">$19</span>
              <p className="text-sm text-[var(--fg-muted)]">700 credits (≈ 350 enriches)</p>
              <button
                type="button"
                className={`mt-1 self-start ${buttonClass}`}
                disabled={loading !== null}
                onClick={() => handlePack('19')}
              >
                {loading === '19' ? 'Opening checkout…' : 'Buy $19'}
              </button>
            </div>
          </div>
        </div>

        <Link
          href="/account"
          className="mt-6 inline-block rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2 text-sm font-medium text-[var(--fg-default)] hover:bg-[var(--draft-muted)]"
        >
          Back to Account
        </Link>
      </main>
    </AppShell>
  );
}

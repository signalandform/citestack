'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match');
      return;
    }
    if (!agreeToTerms) {
      setStatus('error');
      setMessage('You must agree to the Terms of Service to sign up.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            terms_accepted_at: new Date().toISOString(),
            marketing_emails: marketingEmails,
          },
        },
      });
      if (error) {
        setStatus('error');
        setMessage(error.message || 'Something went wrong');
        return;
      }
      if (data.session) {
        await fetch('/api/user-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketing_emails: marketingEmails }),
        });
        router.push('/library');
        return;
      }
      setStatus('success');
      setMessage('Check your email to confirm your account.');
    } catch {
      setStatus('error');
      setMessage('Network error');
    }
  }

  if (status === 'success') {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold text-[var(--fg-default)]">Sign up</h1>
        <div className="mt-6 rounded-lg border border-[var(--border-default)] bg-[var(--success-muted)] p-4 text-sm text-[var(--success)]">
          {message}
        </div>
        <p className="mt-6 text-xs text-[var(--fg-muted)]">
          <a href="/signin" className="text-[var(--accent)] underline hover:no-underline">Sign in</a>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold text-[var(--fg-default)]">Sign up</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Create an account with your email and password.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--fg-default)]">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-[var(--border-default)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--fg-default)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--fg-default)]">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-[var(--border-default)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--fg-default)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium text-[var(--fg-default)]">
            Confirm password
          </label>
          <input
            id="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-[var(--border-default)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--fg-default)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex items-start gap-2">
          <input
            id="agree_terms"
            type="checkbox"
            checked={agreeToTerms}
            onChange={(e) => setAgreeToTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <label htmlFor="agree_terms" className="text-sm text-[var(--fg-default)]">
            I agree to the{' '}
            <Link href="/terms" className="text-[var(--accent)] underline hover:no-underline" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </Link>
          </label>
        </div>

        <div className="flex items-start gap-2">
          <input
            id="marketing_emails"
            type="checkbox"
            checked={marketingEmails}
            onChange={(e) => setMarketingEmails(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <label htmlFor="marketing_emails" className="text-sm text-[var(--fg-default)]">
            I’d like to receive marketing emails (product updates, tips, offers).
          </label>
        </div>

        {message && status === 'error' && (
          <p className="text-sm text-[var(--danger)]">{message}</p>
        )}
        <button
          type="submit"
          disabled={status === 'loading' || !agreeToTerms}
          className="w-full rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
        >
          {status === 'loading' ? 'Signing up…' : 'Sign up'}
        </button>
      </form>

      <p className="mt-6 text-xs text-[var(--fg-muted)]">
        Already have an account? <a href="/signin" className="text-[var(--accent)] underline hover:no-underline">Sign in</a>
      </p>
      <p className="mt-2 text-xs text-[var(--fg-muted)]">
        <a href="/" className="text-[var(--accent)] underline hover:no-underline">
          Back to home
        </a>
      </p>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6"><p className="text-sm text-[var(--fg-muted)]">Loading…</p></main>}>
      <SignUpForm />
    </Suspense>
  );
}

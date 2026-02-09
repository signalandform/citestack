import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';

export default async function Home() {
  const user = await getUser();

  if (user) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-[var(--fg-muted)]">Redirecting…</p>
        <Link className="mt-2 inline-block text-[var(--accent)] underline hover:no-underline" href="/library">
          Go to Library
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-semibold text-[var(--fg-default)]">Citestack</h1>
      <p className="mt-2 text-lg text-[var(--fg-muted)]">
        Your citation-first research library.
      </p>

      <p className="mt-6 text-sm text-[var(--fg-muted)]">
        Save URLs, paste text, or upload files. Citestack extracts and enriches content automatically,
        so you can build a searchable library of papers, articles, and notes — and cite with confidence.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-[var(--fg-default)]">Use cases</h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--fg-muted)]">
          <li>
            <strong className="text-[var(--fg-default)]">Researchers:</strong> Save papers, articles, and web pages; keep everything in one place.
          </li>
          <li>
            <strong className="text-[var(--fg-default)]">Students:</strong> Collect sources for essays and projects; avoid scattered bookmarks.
          </li>
          <li>
            <strong className="text-[var(--fg-default)]">Writers:</strong> Build a reference library of quotes and ideas.
          </li>
          <li>
            <strong className="text-[var(--fg-default)]">Knowledge workers:</strong> Capture and organize reading material for later.
          </li>
        </ul>
      </section>

      <div className="mt-10 flex gap-4">
        <Link
          href="/signin"
          className="rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)]"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-4 py-2 text-sm font-medium text-[var(--fg-default)] hover:bg-[var(--bg-inset)]"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}

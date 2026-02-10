import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="border-t border-[var(--border-default)] text-sm text-[var(--fg-muted)]"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <span>© {year} CiteStack</span>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/students" className="hover:text-[var(--fg-default)]">
            Students
          </Link>
          <Link href="/writers" className="hover:text-[var(--fg-default)]">
            Writers
          </Link>
          <Link href="/privacy" className="hover:text-[var(--fg-default)]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[var(--fg-default)]">
            Terms
          </Link>
          <Link href="/aup" className="hover:text-[var(--fg-default)]">
            AUP
          </Link>
          <a
            href="mailto:jack@signalandformllc.com"
            className="hover:text-[var(--fg-default)]"
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}

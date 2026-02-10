import { readFile } from 'fs/promises';
import { join } from 'path';
import { LegalMarkdown } from '@/app/components/legal-markdown';

export const metadata = {
  title: 'Terms of Service | CiteStack',
};

export default async function TermsPage() {
  let content: string;
  try {
    content = await readFile(
      join(process.cwd(), 'LEGAL_TERMS_OF_SERVICE.md'),
      'utf-8'
    );
  } catch {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold text-[var(--fg-default)]">Terms of Service</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">Content not found.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <LegalMarkdown content={content} />
    </main>
  );
}

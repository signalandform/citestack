import { readFile } from 'fs/promises';
import { join } from 'path';
import { LegalMarkdown } from '@/app/components/legal-markdown';

export const metadata = {
  title: 'Privacy Policy | CiteStack',
};

export default async function PrivacyPage() {
  let content: string;
  try {
    content = await readFile(
      join(process.cwd(), 'LEGAL_PRIVACY_POLICY.md'),
      'utf-8'
    );
  } catch {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold text-[var(--fg-default)]">Privacy Policy</h1>
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

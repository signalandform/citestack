'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/app/components/app-shell';

export default function NewItemPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [urlStatus, setUrlStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [urlMessage, setUrlMessage] = useState('');

  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteStatus, setPasteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pasteMessage, setPasteMessage] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const [fileStatus, setFileStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fileMessage, setFileMessage] = useState('');

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUrlStatus('loading');
    setUrlMessage('');
    try {
      const res = await fetch('/api/capture/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUrlStatus('error');
        setUrlMessage(data.error || 'Failed');
        return;
      }
      setUrl('');
      router.push(`/items/${data.itemId}`);
    } catch {
      setUrlStatus('error');
      setUrlMessage('Network error');
    }
  }

  async function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasteStatus('loading');
    setPasteMessage('');
    try {
      const res = await fetch('/api/capture/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: pasteTitle || undefined, text: pasteText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasteStatus('error');
        setPasteMessage(data.error || 'Failed');
        return;
      }
      setPasteTitle('');
      setPasteText('');
      router.push(`/items/${data.itemId}`);
    } catch {
      setPasteStatus('error');
      setPasteMessage('Network error');
    }
  }

  async function handleFileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setFileMessage('Select a file');
      setFileStatus('error');
      return;
    }
    setFileStatus('loading');
    setFileMessage('');
    try {
      const form = new FormData();
      form.set('file', file);
      if (fileTitle) form.set('title', fileTitle);
      const res = await fetch('/api/capture/file', {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFileStatus('error');
        setFileMessage(data.error || 'Failed');
        return;
      }
      setFile(null);
      setFileTitle('');
      router.push(`/items/${data.itemId}`);
    } catch {
      setFileStatus('error');
      setFileMessage('Network error');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      const target = e.target as HTMLElement;
      const form = target.closest('form');
      if (form) {
        e.preventDefault();
        form.requestSubmit();
      }
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-6" onKeyDown={handleKeyDown}>
        <h1 className="text-xl font-semibold text-[var(--fg-default)]">New item</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Save URLs, paste text, or upload documents (PDF, DOCX, TXT, MD). Each item is extracted and enriched automatically.
        </p>

        <section className="mt-8 border-t border-[var(--border-default)] pt-6">
          <h2 className="text-sm font-medium text-[var(--fg-default)]">Capture URL</h2>
          <form onSubmit={handleUrlSubmit} className="mt-2 flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
              className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--fg-default)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={urlStatus === 'loading'}
              className="rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
            >
              Capture URL
            </button>
          </form>
          {urlStatus === 'error' && urlMessage && (
            <p className="mt-1 text-sm text-[var(--danger)]">{urlMessage}</p>
          )}
        </section>

        <section className="mt-8 border-t border-[var(--border-default)] pt-6">
          <h2 className="text-sm font-medium text-[var(--fg-default)]">Capture paste</h2>
          <form onSubmit={handlePasteSubmit} className="mt-2 space-y-2">
            <input
              type="text"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--fg-default)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste text..."
              required
              rows={4}
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--fg-default)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={pasteStatus === 'loading'}
              className="rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
            >
              Capture paste
            </button>
          </form>
          {pasteStatus === 'error' && pasteMessage && (
            <p className="mt-1 text-sm text-[var(--danger)]">{pasteMessage}</p>
          )}
        </section>

        <section className="mt-8 border-t border-[var(--border-default)] pt-6">
          <h2 className="text-sm font-medium text-[var(--fg-default)]">Capture file</h2>
          <form onSubmit={handleFileSubmit} className="mt-2 space-y-2">
            <input
              type="text"
              value={fileTitle}
              onChange={(e) => setFileTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--fg-default)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--fg-muted)] file:mr-2 file:rounded file:border file:border-[var(--border-default)] file:bg-[var(--draft-muted)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--fg-default)]"
            />
            <button
              type="submit"
              disabled={fileStatus === 'loading' || !file}
              className="rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
            >
              Capture file
            </button>
          </form>
          {fileStatus === 'error' && fileMessage && (
            <p className="mt-1 text-sm text-[var(--danger)]">{fileMessage}</p>
          )}
        </section>
      </main>
    </AppShell>
  );
}

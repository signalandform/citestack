'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/app/components/app-shell';
import { OnboardingBanner } from '@/app/components/onboarding';
import { useToast } from '@/app/contexts/toast';

function isUrl(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  try {
    new URL(t);
    return /^https?:\/\//i.test(t);
  } catch {
    return false;
  }
}

export default function NewItemPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [quickInput, setQuickInput] = useState('');
  const [quickStatus, setQuickStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [quickMessage, setQuickMessage] = useState('');

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_MB = 50;

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
      showToast('Saved to CiteStack', 'success', {
        linkUrl: `/items/${data.itemId}`,
        linkLabel: 'Open item',
      });
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
      showToast('Saved to CiteStack', 'success', {
        linkUrl: `/items/${data.itemId}`,
        linkLabel: 'Open item',
      });
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
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileMessage(`File is too large. Maximum size is ${MAX_FILE_MB}MB.`);
      setFileStatus('error');
      return;
    }
    if (file.size === 0) {
      setFileMessage('File is empty.');
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
        setFileMessage(data.error || 'Upload failed. Please try again.');
        return;
      }
      showToast('Saved to CiteStack', 'success', {
        linkUrl: `/items/${data.itemId}`,
        linkLabel: 'Open item',
      });
      setFile(null);
      setFileTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.push(`/items/${data.itemId}`);
    } catch {
      setFileStatus('error');
      setFileMessage('Network error. Check your connection and try again.');
    }
  }

  async function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = quickInput.trim();
    if (!text) return;
    setQuickStatus('loading');
    setQuickMessage('');
    try {
      if (isUrl(text)) {
        const res = await fetch('/api/capture/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: text }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setQuickStatus('error');
          setQuickMessage(data.error || 'Failed');
          return;
        }
        showToast('Saved to CiteStack', 'success', {
          linkUrl: `/items/${data.itemId}`,
          linkLabel: 'Open item',
        });
        setQuickInput('');
        router.push(`/items/${data.itemId}`);
      } else {
        const res = await fetch('/api/capture/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setQuickStatus('error');
          setQuickMessage(data.error || 'Failed');
          return;
        }
        showToast('Saved to CiteStack', 'success', {
          linkUrl: `/items/${data.itemId}`,
          linkLabel: 'Open item',
        });
        setQuickInput('');
        router.push(`/items/${data.itemId}`);
      }
    } catch {
      setQuickStatus('error');
      setQuickMessage('Network error');
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
        <h1 className="text-2xl font-semibold text-[var(--fg-default)]">New item</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Save URLs, paste text, or upload documents. Each item is extracted and enriched automatically.
        </p>

        <div className="mt-4">
          <OnboardingBanner variant="new" />
        </div>

        <div className="mt-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-5">
          <form onSubmit={handleQuickSubmit} className="flex gap-3">
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Paste URL or text…"
              className="filter-input flex-1 px-4 py-3 text-base"
            />
            <button
              type="submit"
              disabled={quickStatus === 'loading' || !quickInput.trim()}
              className="shrink-0 rounded bg-[var(--btn-primary)] px-5 py-3 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
            >
              {quickStatus === 'loading' ? 'Capturing…' : 'Capture'}
            </button>
          </form>
          <p className="mt-2 text-xs text-[var(--fg-muted)]">
            URL or paste — we&apos;ll detect it
          </p>
          {quickStatus === 'error' && quickMessage && (
            <p className="mt-2 text-sm text-[var(--danger)]">{quickMessage}</p>
          )}
        </div>

        <h2 className="mt-10 text-sm font-medium text-[var(--fg-muted)]">More options</h2>
        <div className="mt-3 space-y-4">
          <section className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">URL</p>
            <form onSubmit={handleUrlSubmit} className="mt-3 flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                required
                className="filter-input flex-1 px-3 py-2"
              />
              <button
                type="submit"
                disabled={urlStatus === 'loading'}
                className="shrink-0 rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
              >
                {urlStatus === 'loading' ? 'Capturing…' : 'Capture'}
              </button>
            </form>
            {urlStatus === 'error' && urlMessage && (
              <p className="mt-2 text-sm text-[var(--danger)]">{urlMessage}</p>
            )}
          </section>

          <section className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">Paste</p>
            <form onSubmit={handlePasteSubmit} className="mt-3 space-y-2">
              <input
                type="text"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                placeholder="Title (optional)"
                className="filter-input w-full px-3 py-2"
              />
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste text..."
                required
                rows={4}
                className="filter-input w-full resize-y px-3 py-2"
              />
              <button
                type="submit"
                disabled={pasteStatus === 'loading'}
                className="rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
              >
                {pasteStatus === 'loading' ? 'Capturing…' : 'Capture paste'}
              </button>
            </form>
            {pasteStatus === 'error' && pasteMessage && (
              <p className="mt-2 text-sm text-[var(--danger)]">{pasteMessage}</p>
            )}
          </section>

          <section className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">File</p>
            <form onSubmit={handleFileSubmit} className="mt-3 space-y-2">
              <input
                type="text"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder="Title (optional)"
                className="filter-input w-full px-3 py-2"
              />
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--control-bg)] px-3 py-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setFileStatus('idle');
                    setFileMessage('');
                  }}
                  className="block w-full text-sm text-[var(--fg-default)] file:mr-3 file:rounded file:border file:border-[var(--border-default)] file:bg-[var(--draft-muted)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--fg-default)]"
                />
              </div>
              <p className="text-xs text-[var(--fg-muted)]">PDF, DOCX, TXT, MD — max {MAX_FILE_MB}MB</p>
              <button
                type="submit"
                disabled={fileStatus === 'loading' || !file}
                className="rounded bg-[var(--btn-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50"
              >
                {fileStatus === 'loading' ? 'Capturing…' : 'Capture file'}
              </button>
            </form>
            {fileStatus === 'error' && fileMessage && (
              <p className="mt-2 text-sm text-[var(--danger)]">{fileMessage}</p>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

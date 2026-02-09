'use client';

import { useEffect, useState } from 'react';

type ToastProps = { message: string; onDismiss: () => void };

export function Toast({ message, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 200);
    }, 2000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] px-4 py-2 text-sm text-[var(--fg-default)] shadow-lg"
    >
      {message}
    </div>
  );
}

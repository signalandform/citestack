'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastType = 'success' | 'error' | 'neutral';

export type ToastOptions = {
  linkUrl?: string;
  linkLabel?: string;
};

type ToastState = {
  message: string;
  type: ToastType;
  options?: ToastOptions;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = 'neutral', options?: ToastOptions) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setToast({ message, type, options });
      timeoutRef.current = setTimeout(() => {
        setToast(null);
        timeoutRef.current = null;
      }, 2000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-4 py-2 text-sm shadow-lg ${
            toast.type === 'error'
              ? 'border-[var(--danger-muted)] bg-[var(--danger-muted)] text-[var(--danger)]'
              : toast.type === 'success'
                ? 'border-[var(--success-muted)] bg-[var(--success-muted)] text-[var(--success)]'
                : 'border-[var(--border-default)] bg-[var(--bg-default)] text-[var(--fg-default)]'
          }`}
        >
          <span>
            {toast.message}
            {toast.options?.linkUrl && toast.options?.linkLabel && (
              <>
                {' · '}
                <Link
                  href={toast.options.linkUrl}
                  className="underline decoration-current underline-offset-2 hover:opacity-90"
                >
                  {toast.options.linkLabel}
                </Link>
              </>
            )}
          </span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/app/contexts/toast';

type Collection = { id: string; name: string };

type Props = {
  itemId: string;
  collectionIds: string[];
  collections: Collection[];
  onUpdate: () => void;
  compact?: boolean;
};

export function CollectionPicker({
  itemId,
  collectionIds,
  collections,
  onUpdate,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  const toggleCollection = useCallback(
    async (collectionId: string, add: boolean) => {
      try {
        if (add) {
          const res = await fetch(`/api/collections/${collectionId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId }),
          });
          if (res.ok) {
            showToast('Added to collection', 'success');
            onUpdate();
          }
        } else {
          const res = await fetch(
            `/api/collections/${collectionId}/items?itemId=${encodeURIComponent(itemId)}`,
            { method: 'DELETE' }
          );
          if (res.ok) {
            showToast('Removed from collection', 'success');
            onUpdate();
          }
        }
      } catch {
        showToast('Failed', 'error');
      }
    },
    [itemId, onUpdate, showToast]
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const inCollection = new Set(collectionIds);
  const names = collections.filter((c) => collectionIds.includes(c.id)).map((c) => c.name);
  const hasCollections = names.length > 0;
  const buttonLabel = hasCollections
    ? names.length <= 2
      ? names.join(', ')
      : `${names[0]} +${names.length - 1}`
    : '+ Add to collection';
  const buttonTitle = hasCollections
    ? `Collection(s): ${names.join(', ')}`
    : 'Add to collection';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className={`rounded border border-[var(--border-default)] bg-[var(--bg-default)] px-2 py-0.5 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-inset)] ${
          compact ? 'px-1.5 py-0' : ''
        }`}
        title={buttonTitle}
      >
        {buttonLabel}
      </button>
      {open && (
        <ul
          className="absolute left-0 top-full z-20 mt-1 max-h-48 w-48 overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {collections.length === 0 ? (
            <li className="px-2 py-1 text-xs text-[var(--fg-muted)]">No collections yet</li>
          ) : (
            collections.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    toggleCollection(c.id, !inCollection.has(c.id));
                  }}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs text-[var(--fg-default)] hover:bg-[var(--bg-inset)]"
                >
                  <span className={inCollection.has(c.id) ? 'font-medium' : ''}>{c.name}</span>
                  {inCollection.has(c.id) && <span className="text-[var(--success)]">✓</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

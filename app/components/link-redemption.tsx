'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LinkRedemption() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;

    (async () => {
      const supabase = createClient();
      await supabase.auth.getSession(); // exchanges hash for cookies if present
      const hadHash = typeof window !== 'undefined' && window.location.hash.includes('access_token');

      await fetch('/api/auth/link-redemption', { method: 'POST', credentials: 'include' }).catch(() => {});

      if (hadHash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    })();
  }, []);
  return null;
}

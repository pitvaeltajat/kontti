'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

const SAVED_TITLES: Record<string, string> = {
  item: 'Tuote tallennettu',
  event: 'Tapahtuma tallennettu',
  category: 'Kategoria tallennettu',
  discount: 'Koodi tallennettu',
  role: 'Rooli päivitetty',
};

/** Fires a toast for a `?saved=<key>` redirect, then strips only that param. */
export function FlashToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { success } = useToast();
  const firedRef = useRef<string | null>(null);

  const saved = searchParams.get('saved');

  useEffect(() => {
    if (!saved) {
      firedRef.current = null;
      return;
    }
    // React Strict Mode runs effects twice; only fire once per key.
    if (firedRef.current === saved) return;
    firedRef.current = saved;

    const title = SAVED_TITLES[saved];
    if (title) success(title);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('saved');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [saved, searchParams, pathname, router, success]);

  return null;
}

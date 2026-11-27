'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import { Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type ConfirmState = 'pending' | 'confirmed' | 'timeout' | 'changed';

const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 8;

export function SuccessStatus({
  sessionId,
  orderId,
  initialStatus,
  optimisticPaid,
  freeRegistration,
}: {
  sessionId?: string;
  orderId?: string;
  initialStatus?: OrderStatus;
  optimisticPaid: boolean;
  freeRegistration: boolean;
}) {
  const router = useRouter();
  const initiallyConfirmed =
    freeRegistration || initialStatus === 'PAID' || initialStatus === 'COMPLETED';
  const enabled = initiallyConfirmed || optimisticPaid || Boolean(sessionId);
  const hasQuery = Boolean(sessionId || orderId);
  const [state, setState] = useState<ConfirmState>(() => {
    if (initiallyConfirmed) return 'confirmed';
    if (!hasQuery) return 'timeout';
    return 'pending';
  });
  const attemptsRef = useRef(0);
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (!enabled || state !== 'pending') return;

    const query = sessionId
      ? `session_id=${encodeURIComponent(sessionId)}`
      : orderId
        ? `order_id=${encodeURIComponent(orderId)}`
        : null;
    if (!query) return;

    let cancelled = false;
    let timer: number | null = null;
    attemptsRef.current = 0;

    async function poll() {
      if (cancelled) return;
      attemptsRef.current += 1;
      try {
        const response = await fetch(`/api/success/order-status?${query}`, {
          cache: 'no-store',
        });
        if (response.status === 404) {
          setState('timeout');
          return;
        }
        if (response.ok) {
          const data = (await response.json()) as { status?: OrderStatus };
          if (data.status === 'PAID' || data.status === 'COMPLETED') {
            if (!refreshedRef.current) {
              refreshedRef.current = true;
              router.refresh();
            }
            setState('confirmed');
            return;
          }
          if (data.status === 'CANCELLED') {
            setState('changed');
            return;
          }
        }
      } catch {
        // Network errors keep polling until the attempt cap.
      }
      if (cancelled) return;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        setState('timeout');
        return;
      }
      timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    }

    timer = window.setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [enabled, state, sessionId, orderId, router]);

  if (!enabled) return null;

  const line =
    state === 'pending'
      ? 'Vahvistetaan maksua…'
      : state === 'confirmed'
        ? freeRegistration
          ? 'Ilmoittautuminen vahvistettu'
          : 'Maksu vahvistettu'
        : state === 'timeout'
          ? 'Maksua vahvistetaan vielä'
          : 'Tilauksen tila on muuttunut. Ota yhteyttä: info@pitkajarvenvaeltajat.fi.';

  return (
    <div className="space-y-2">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
          state === 'pending' && 'bg-accent/60 text-primary',
          state === 'confirmed' && 'bg-success/10 text-success',
          (state === 'timeout' || state === 'changed') && 'bg-muted text-muted-foreground',
        )}
      >
        {state === 'pending' && (
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-primary/30 border-t-primary motion-reduce:animate-none"
          />
        )}
        {state === 'confirmed' && <Check aria-hidden="true" className="size-4 shrink-0" />}
        {(state === 'timeout' || state === 'changed') && (
          <Clock aria-hidden="true" className="size-4 shrink-0" />
        )}
        <span>{line}</span>
      </div>

      {state === 'pending' && (
        <>
          <div aria-hidden="true" className="h-[3px] overflow-hidden rounded-full bg-primary/10">
            <span className="block h-full w-[35%] animate-progress-indeterminate bg-primary motion-reduce:animate-none" />
          </div>
          <p className="text-xs text-muted-foreground">Tämä kestää yleensä vain hetken.</p>
        </>
      )}

      {state === 'timeout' && (
        <>
          <p className="text-xs text-muted-foreground">
            Vahvistus voi kestää hetken. Älä maksa uudelleen. Kuitti lähetetään sähköpostiisi heti,
            kun maksu on kirjautunut.
          </p>
          {hasQuery && (
            <Button variant="outline" size="sm" onClick={() => setState('pending')}>
              Tarkista tila uudelleen
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Jos maksu ei näy muutaman minuutin kuluttua, ota yhteyttä:{' '}
            <span className="whitespace-nowrap">info@pitkajarvenvaeltajat.fi</span>.
          </p>
        </>
      )}
    </div>
  );
}

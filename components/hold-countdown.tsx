'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button-link';
import { cn } from '@/lib/cn';
import { HOLD_MINUTES } from '@/lib/kammi';

/** The budget the progress bar is measured against. */
const HOLD_BUDGET_SECONDS = HOLD_MINUTES * 60;
const WARNING_SECONDS = 5 * 60;

type CountdownState = 'normal' | 'warning' | 'expired';

function remainingSeconds(expiresAt: string): number {
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.round((target - Date.now()) / 1000));
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function formatDeadline(expiresAt: string): string {
  const date = new Date(expiresAt);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} klo ${hours}:${minutes}`;
}

export function HoldCountdown({
  expiresAt,
  onExpired,
  className,
}: {
  expiresAt: string;
  onExpired?: () => void;
  className?: string;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const tick = () => setRemaining(remainingSeconds(expiresAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const expired = remaining !== null && remaining <= 0;
  const warning = remaining !== null && remaining > 0 && remaining < WARNING_SECONDS;
  const state: CountdownState = expired ? 'expired' : warning ? 'warning' : 'normal';

  useEffect(() => {
    if (expired && !firedRef.current) {
      firedRef.current = true;
      onExpired?.();
    } else if (!expired) {
      firedRef.current = false;
    }
  }, [expired, onExpired]);

  const progress =
    remaining === null
      ? 100
      : Math.min(100, Math.max(0, (remaining / HOLD_BUDGET_SECONDS) * 100));

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3.5',
        state === 'warning' && 'border-warning/40 bg-warning/10',
        state === 'expired' && 'border-destructive/40 bg-destructive/10',
        className,
      )}
    >
      {state === 'expired' ? (
        <div
          className="flex items-center gap-1.5 text-sm font-semibold text-destructive"
          aria-live="polite"
        >
          <XCircle className="size-4" aria-hidden="true" />
          Varaus on vapautunut
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold',
              state === 'warning' ? 'text-warning' : 'text-foreground',
            )}
            aria-live="polite"
          >
            {state === 'warning' ? (
              <AlertTriangle className="size-4" aria-hidden="true" />
            ) : (
              <Clock className="size-4 text-primary" aria-hidden="true" />
            )}
            {state === 'warning' ? 'Maksuaika päättymässä' : 'Aikaa maksaa'}
          </span>
          <span
            className={cn(
              'text-xl font-bold tabular-nums tracking-wide',
              state === 'warning' ? 'text-warning' : 'text-foreground',
            )}
            aria-live="off"
          >
            {remaining === null ? '--:--' : formatDuration(remaining)}
          </span>
        </div>
      )}

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span
          className={cn(
            'block h-full rounded-full transition-[width] duration-500',
            state === 'warning' ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {state === 'normal' && (
        <p className="mt-2 text-xs text-muted-foreground">
          Maksu viimeistään {formatDeadline(expiresAt)}. Varaus vapautuu, jos maksu ei ehdi perille.
        </p>
      )}
      {state === 'warning' && (
        <p className="mt-2 text-xs text-warning">
          Viimeistele maksu nyt, jotta varaus ei vapaudu.
        </p>
      )}
      {state === 'expired' && (
        <>
          <p className="mt-2 text-xs text-destructive/90">
            Maksuaika päättyi. Valitse päivät uudelleen kalenterista.
          </p>
          <ButtonLink
            href="/kammi"
            variant="outline"
            size="sm"
            className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            Valitse uudet päivät
          </ButtonLink>
        </>
      )}
    </div>
  );
}

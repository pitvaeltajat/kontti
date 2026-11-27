'use client';

import { formatCents } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { LoadingPill } from '@/components/ui/loading-pill';

type StickySummaryBarProps = {
  totalCents: number;
  ctaLabel: string;
  onCta: () => void;
  disabled?: boolean;
  loading?: boolean;
  free?: boolean;
};

export function StickySummaryBar({
  totalCents,
  ctaLabel,
  onCta,
  disabled = false,
  loading = false,
  free = false,
}: StickySummaryBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-card px-4 pt-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden"
      style={{ paddingBottom: 'calc(0.6rem + env(safe-area-inset-bottom))' }}
    >
      <span className="text-xs text-muted-foreground">
        Yhteensä{' '}
        <strong className="block text-base font-bold text-foreground">
          {free ? 'Maksuton' : formatCents(totalCents)}
        </strong>
      </span>
      <Button variant="cta" size="lg" onClick={onCta} disabled={disabled || loading}>
        {loading ? <LoadingPill className="bg-current/25" /> : ctaLabel}
      </Button>
    </div>
  );
}

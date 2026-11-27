import type { LucideIcon } from 'lucide-react';
import { Shield, ShieldCheck } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

export type StatusKind = 'order' | 'item' | 'event' | 'user' | 'payout' | 'registrant';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

type StatusMeta = {
  label: string;
  variant: BadgeVariant;
  icon?: LucideIcon;
};

export type StatusBadgeProps = {
  status: string;
  kind: StatusKind;
  label?: string;
  variant?: BadgeVariant;
  className?: string;
};

// Items, events and users pass derived status strings (`active`/`hidden`/`over`/
// `inactive` and role names) instead of raw DB booleans. Registrant `REFUNDED`
// is derived from `participantRefundedAt`.
export const STATUS_REGISTRY: Record<StatusKind, Record<string, StatusMeta>> = {
  order: {
    RECEIVED: { label: 'Vastaanotettu', variant: 'warning' },
    PAID: { label: 'Maksettu', variant: 'success' },
    COMPLETED: { label: 'Maksettu', variant: 'success' },
    CANCELLED: { label: 'Peruutettu', variant: 'secondary' },
  },
  item: {
    active: { label: 'Näkyvissä', variant: 'success' },
    hidden: { label: 'Piilotettu', variant: 'secondary' },
  },
  event: {
    active: { label: 'Näkyvissä', variant: 'success' },
    hidden: { label: 'Piilotettu', variant: 'secondary' },
    over: { label: 'Päättynyt', variant: 'warning' },
    inactive: { label: 'Ei myynnissä', variant: 'secondary' },
  },
  user: {
    SUPERADMIN: { label: 'Pääylläpitäjä', variant: 'default', icon: ShieldCheck },
    EVENT_ADMIN: { label: 'Tapahtumavastaava', variant: 'warning', icon: Shield },
    USER: { label: 'Käyttäjä', variant: 'secondary' },
  },
  payout: {
    paid: { label: 'Maksettu', variant: 'success' },
    in_transit: { label: 'Matkalla', variant: 'warning' },
    pending: { label: 'Odottaa', variant: 'warning' },
    canceled: { label: 'Peruttu', variant: 'secondary' },
    failed: { label: 'Epäonnistui', variant: 'destructive' },
  },
  registrant: {
    PAID: { label: 'Maksettu', variant: 'success' },
    RECEIVED: { label: 'Lasku avoinna', variant: 'warning' },
    CANCELLED: { label: 'Peruutettu', variant: 'secondary' },
    REFUNDED: { label: 'Hyvitetty', variant: 'secondary' },
  },
};

export function StatusBadge({ status, kind, label, variant, className }: StatusBadgeProps) {
  const meta = STATUS_REGISTRY[kind][status] ?? {
    label: status,
    variant: 'secondary' as const,
  };
  const Icon = meta.icon;

  return (
    <Badge variant={variant ?? meta.variant} className={cn(Icon ? 'gap-1' : undefined, className)}>
      {Icon && <Icon aria-hidden="true" className="size-3" />}
      {label ?? meta.label}
    </Badge>
  );
}

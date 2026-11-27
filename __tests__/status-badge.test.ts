import { describe, expect, it } from 'vitest';
import { STATUS_REGISTRY } from '@/components/ui/status-badge';

describe('STATUS_REGISTRY', () => {
  it('maps order statuses to Finnish labels and badge variants', () => {
    expect(STATUS_REGISTRY.order.PAID).toEqual({ label: 'Maksettu', variant: 'success' });
    expect(STATUS_REGISTRY.order.RECEIVED).toEqual({
      label: 'Vastaanotettu',
      variant: 'warning',
    });
    expect(STATUS_REGISTRY.order.CANCELLED).toEqual({
      label: 'Peruutettu',
      variant: 'secondary',
    });
  });

  it('maps registrant statuses', () => {
    expect(STATUS_REGISTRY.registrant.PAID).toEqual({ label: 'Maksettu', variant: 'success' });
    expect(STATUS_REGISTRY.registrant.RECEIVED).toEqual({
      label: 'Lasku avoinna',
      variant: 'warning',
    });
    expect(STATUS_REGISTRY.registrant.REFUNDED).toEqual({
      label: 'Hyvitetty',
      variant: 'secondary',
    });
  });

  it('maps payout statuses', () => {
    expect(STATUS_REGISTRY.payout.failed).toEqual({
      label: 'Epäonnistui',
      variant: 'destructive',
    });
    expect(STATUS_REGISTRY.payout.in_transit).toEqual({
      label: 'Matkalla',
      variant: 'warning',
    });
  });

  it('maps user roles and keeps their icons', () => {
    expect(STATUS_REGISTRY.user.SUPERADMIN.label).toBe('Pääylläpitäjä');
    expect(STATUS_REGISTRY.user.SUPERADMIN.icon).toBeDefined();
    expect(STATUS_REGISTRY.user.USER).toEqual({ label: 'Käyttäjä', variant: 'secondary' });
  });
});

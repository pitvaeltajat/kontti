import { describe, expect, it } from 'vitest';
import { registrantStatus, type RegistrantRow } from '@/components/admin/registrants-table';

function row(overrides: Partial<RegistrantRow> = {}): RegistrantRow {
  return {
    id: 'r1',
    participantId: null,
    orderId: 'o1',
    name: 'Testi',
    email: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'PAID',
    answers: {},
    orderPaidAt: null,
    orderStripeSessionId: null,
    orderTotalCents: 0,
    participantCancelled: false,
    participantCancelledAt: null,
    participantPriceCents: 0,
    participantRefundedAt: null,
    ...overrides,
  };
}

describe('registrantStatus', () => {
  it('marks a refunded participant as REFUNDED', () => {
    expect(registrantStatus(row({ participantRefundedAt: '2026-01-02T00:00:00.000Z' }))).toBe(
      'REFUNDED',
    );
  });

  it('passes through RECEIVED and CANCELLED', () => {
    expect(registrantStatus(row({ status: 'RECEIVED' }))).toBe('RECEIVED');
    expect(registrantStatus(row({ status: 'CANCELLED' }))).toBe('CANCELLED');
  });

  it('defaults to PAID for paid and legacy completed orders', () => {
    expect(registrantStatus(row({ status: 'PAID' }))).toBe('PAID');
    expect(registrantStatus(row({ status: 'COMPLETED' }))).toBe('PAID');
  });

  it('prefers REFUNDED over the order status', () => {
    expect(
      registrantStatus(
        row({ status: 'CANCELLED', participantRefundedAt: '2026-01-02T00:00:00.000Z' }),
      ),
    ).toBe('REFUNDED');
  });
});

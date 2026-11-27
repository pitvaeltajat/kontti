import { afterEach, describe, expect, it, vi } from 'vitest';

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findFirst } },
}));

import { GET } from '@/app/api/success/order-status/route';

afterEach(() => findFirst.mockReset());

const call = (query: string) =>
  GET(new Request(`http://localhost/api/success/order-status?${query}`));

describe('order-status route', () => {
  it('returns 404 when no params are given', async () => {
    const res = await call('');
    expect(res.status).toBe(404);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown order', async () => {
    findFirst.mockResolvedValue(null);
    const res = await call('order_id=missing');
    expect(res.status).toBe(404);
  });

  it('returns the status with no-store for a valid session_id', async () => {
    findFirst.mockResolvedValue({ status: 'PAID' });
    const res = await call('session_id=cs_test_123');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'PAID' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns the status with no-store for a valid order_id', async () => {
    findFirst.mockResolvedValue({ status: 'COMPLETED' });
    const res = await call('order_id=order_123');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'COMPLETED' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 404 for an invalid session_id', async () => {
    const res = await call('session_id=not_a_session');
    expect(res.status).toBe(404);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 for an over-long order_id', async () => {
    const res = await call(`order_id=${'a'.repeat(65)}`);
    expect(res.status).toBe(404);
    expect(findFirst).not.toHaveBeenCalled();
  });
});

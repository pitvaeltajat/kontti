import { describe, expect, it } from 'vitest';

import { savedRedirect } from '@/lib/saved-redirect';

describe('savedRedirect', () => {
  it('appends saved to a path with no query string', () => {
    expect(savedRedirect('/admin/items', 'item')).toBe('/admin/items?saved=item');
  });

  it('preserves existing query params', () => {
    expect(savedRedirect('/admin/orders?status=PAID', 'order')).toBe(
      '/admin/orders?status=PAID&saved=order',
    );
  });

  it('replaces an existing saved param instead of duplicating it', () => {
    expect(savedRedirect('/admin/items?saved=old&page=2', 'item')).toBe(
      '/admin/items?saved=item&page=2',
    );
  });
});

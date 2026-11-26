import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { hideItem, restoreItem } from '@/lib/actions/admin';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { FormButton } from '@/components/admin/form-button';
import { lowestVariantPrice } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Tuotteet' };

export default async function AdminItemsPage() {
  await requireSuperAdmin();
  const items = await prisma.item.findMany({
    where: { isEvent: false },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      category: true,
      variants: { where: { active: true }, select: { priceCents: true } },
    },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tuotteet ({items.length})</h1>
        <ButtonLink href="/admin/items/new" variant="cta">
          <Plus /> Uusi tuote
        </ButtonLink>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-4 py-10 text-center">
          <p className="font-semibold">Ei tuotteita vielä</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Luo ensimmäinen tuote, niin se näkyy kaupassa.
          </p>
          <ButtonLink href="/admin/items/new" variant="cta" className="mt-4">
            <Plus /> Luo ensimmäinen tuote
          </ButtonLink>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Kaupan tuotteet</caption>
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th scope="col" className="px-4 py-3">
                  Tuote
                </th>
                <th scope="col" className="px-4 py-3">
                  Kategoria
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Hinta
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Varasto
                </th>
                <th scope="col" className="px-4 py-3">
                  Tila
                </th>
                <th scope="col" className="px-4 py-3">
                  Etusivu
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Toiminnot
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/${item.slug}`}
                      className="hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.name}
                      <span className="ml-1 text-xs text-muted-foreground">↗</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.category.name}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCents(lowestVariantPrice(item.variants))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.stock === null ? 'Rajoittamaton' : item.stock}
                  </td>
                  <td className="px-4 py-3">
                    {item.active ? (
                      <Badge variant="success">Näkyvissä</Badge>
                    ) : (
                      <Badge variant="secondary">Piilotettu</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.featured ? 'Nosto' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <ButtonLink href={`/admin/items/${item.id}`} size="sm" variant="outline">
                        Muokkaa
                      </ButtonLink>
                      {item.active ? (
                        <form action={hideItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <FormButton
                            size="sm"
                            variant="ghost"
                            confirm={`Piilota "${item.name}" kaupasta? Voit palauttaa sen muokkaamalla.`}
                          >
                            Piilota
                          </FormButton>
                        </form>
                      ) : (
                        <form action={restoreItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <FormButton size="sm" variant="ghost">
                            Palauta
                          </FormButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

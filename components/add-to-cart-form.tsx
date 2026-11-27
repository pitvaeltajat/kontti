'use client';

import { useState } from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { cartStore } from '@/lib/cart';
import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { useToast } from '@/components/ui/toast';

export function AddToCartForm({
  itemId,
  name,
  variants = [],
  withQuantity = false,
  disabled = false,
  disabledLabel,
  className,
}: {
  itemId: string;
  name: string;
  variants?: { id: string; name: string | null; priceCents: number }[];
  withQuantity?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  className?: string;
}) {
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState(
    () =>
      variants.reduce((min, v) => (v.priceCents < min.priceCents ? v : min), variants[0])?.id ?? '',
  );
  const [hasAdded, setHasAdded] = useState(false);

  function handleAdd() {
    cartStore.add(itemId, quantity, variantId || undefined);
    setHasAdded(true);
    const variant = variants.find((candidate) => candidate.id === variantId);
    const variantSuffix = variant?.name ? ` (${variant.name})` : '';
    toast.success('Lisätty ostoskoriin', {
      description: `${quantity} × ${name}${variantSuffix}`,
    });
  }

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      {variants.length > 1 && (
        <label className="flex min-w-56 flex-col gap-1 text-sm">
          <span className="font-medium">Vaihtoehto</span>
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            className="h-10 rounded-md border border-input bg-card px-3 text-sm"
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name} - {formatCents(variant.priceCents)}
              </option>
            ))}
          </select>
        </label>
      )}
      {withQuantity && (
        <div className="flex h-10 items-center rounded-md border border-input bg-card">
          <button
            type="button"
            aria-label="Vähennä määrää"
            className="tap-target flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Lisää määrää"
            className="tap-target flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
      <Button type="button" disabled={disabled} onClick={handleAdd} className="min-w-44">
        {disabled && disabledLabel ? disabledLabel : 'Lisää ostoskoriin'}
      </Button>
      {hasAdded && (
        <ButtonLink href="/cart" variant="outline">
          Siirry ostoskoriin <ArrowRight />
        </ButtonLink>
      )}
    </div>
  );
}

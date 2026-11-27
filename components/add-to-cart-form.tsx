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
  stock = null,
  isEvent = false,
  withQuantity = false,
  disabled = false,
  disabledLabel,
  className,
}: {
  itemId: string;
  name: string;
  variants?: { id: string; name: string | null; priceCents: number }[];
  stock?: number | null;
  isEvent?: boolean;
  withQuantity?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  className?: string;
}) {
  const toast = useToast();
  const [quantity, setQuantity] = useState(() =>
    stock === null ? 1 : Math.max(0, Math.min(1, stock)),
  );
  const maxQuantity = stock === null ? 99 : Math.min(stock, 99);
  const atStock = quantity >= maxQuantity;
  const stockHintId = `add-stock-${itemId}`;

  // A later stock change (e.g. a refresh lowering availability) must not leave
  // the stepper above the new cap. Adjust during render, not in an effect.
  const [prevMaxQuantity, setPrevMaxQuantity] = useState(maxQuantity);
  if (maxQuantity !== prevMaxQuantity) {
    setPrevMaxQuantity(maxQuantity);
    setQuantity((q) => Math.min(q, maxQuantity));
  }
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
        <div className="flex flex-col gap-1">
          <div className="flex h-10 items-center rounded-md border border-input bg-card">
            <button
              type="button"
              aria-label="Vähennä määrää"
              className="tap-target flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
              disabled={quantity <= 1}
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
              aria-describedby={!isEvent && stock !== null && stock <= 3 ? stockHintId : undefined}
              className="tap-target flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
              disabled={atStock}
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            >
              <Plus className="size-4" />
            </button>
          </div>
          {!isEvent && stock !== null && stock <= 3 && (
            <p
              id={stockHintId}
              aria-live="polite"
              className={
                stock === 0
                  ? 'text-xs font-medium text-destructive'
                  : 'text-xs font-medium text-warning'
              }
            >
              {stock === 0 ? 'Loppu varastosta' : `Vain ${stock} jäljellä`}
            </p>
          )}
        </div>
      )}
      <Button
        type="button"
        disabled={disabled || quantity < 1}
        onClick={handleAdd}
        className="min-w-44"
      >
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

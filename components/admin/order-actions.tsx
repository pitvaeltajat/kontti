'use client';

import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelOrder, refundOrder, type ActionResult } from '@/lib/actions/admin';
import { formatCents } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';

export function CancelOrderForm({
  orderId,
  statusParam,
}: {
  orderId: string;
  statusParam?: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const router = useRouter();

  const [state, action, pending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await cancelOrder(prev, formData);
      if (result.ok) {
        setOpen(false);
        toast.success('Tilaus peruttu', {
          description: `Tilaus #${orderId.slice(-8).toUpperCase()} on peruttu.`,
        });
        router.refresh();
      }
      return result;
    },
    {},
  );

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Peru tilaus
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Peru tilaus"
        description="Perutaanko tilaus? Tätä ei voi perua."
        confirmLabel="Peru tilaus"
        cancelLabel="Älä peru"
        tone="destructive"
        onConfirm={() => formRef.current?.requestSubmit()}
        pending={pending}
        error={state.error}
      >
        <form ref={formRef} action={action}>
          <input type="hidden" name="id" value={orderId} />
          <input type="hidden" name="status" value={statusParam ?? ''} />
        </form>
      </ConfirmDialog>
    </>
  );
}

export function RefundOrderForm({
  orderId,
  statusParam,
  amountCents,
}: {
  orderId: string;
  statusParam?: string;
  amountCents: number;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const router = useRouter();

  const [state, action, pending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await refundOrder(prev, formData);
      if (result.ok) {
        setOpen(false);
        toast.success('Maksu palautettu', {
          description: `${formatCents(amountCents)} palautetaan asiakkaan kortille.`,
        });
        router.refresh();
      }
      return result;
    },
    {},
  );

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Palauta maksu
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Palauta maksu"
        description={`Palautettava summa ${formatCents(amountCents)}. Haluatko varmasti palauttaa maksun? Summa palautetaan asiakkaan maksukortille.`}
        confirmLabel={`Palauta ${formatCents(amountCents)}`}
        cancelLabel="Älä palauta"
        tone="destructive"
        onConfirm={() => formRef.current?.requestSubmit()}
        pending={pending}
        error={state.error}
      >
        <form ref={formRef} action={action}>
          <input type="hidden" name="id" value={orderId} />
          <input type="hidden" name="status" value={statusParam ?? ''} />
        </form>
      </ConfirmDialog>
    </>
  );
}

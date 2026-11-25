'use client';

import { useActionState, useEffect, useRef } from 'react';
import { cancelOrder, refundOrder, type ActionResult } from '@/lib/actions/admin';
import { formatCents } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { LoadingPill } from '@/components/ui/loading-pill';

/** Close the surrounding <dialog> once the action succeeds, so a successful
 * cancel/refund doesn't leave the modal open. Errors keep it open to show. */
function useCloseDialogOnSuccess(state: ActionResult) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.closest('dialog')?.close();
    window.location.reload();
  }, [state]);
  return formRef;
}

export function CancelOrderForm({
  orderId,
  statusParam,
}: {
  orderId: string;
  statusParam?: string;
}) {
  const [state, action, pending] = useActionState(cancelOrder, {});
  const formRef = useCloseDialogOnSuccess(state);
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value={statusParam ?? ''} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? <LoadingPill className="bg-current/25" /> : 'Peru tilaus'}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
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
  const [state, action, pending] = useActionState(refundOrder, {});
  const formRef = useCloseDialogOnSuccess(state);
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value={statusParam ?? ''} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? (
          <LoadingPill className="bg-current/25" />
        ) : (
          `Palauta ${formatCents(amountCents)}`
        )}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

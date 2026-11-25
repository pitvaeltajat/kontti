'use client';

import { useActionState, useEffect, useRef } from 'react';
import { cancelRegistrant, refundRegistrant, type ActionResult } from '@/lib/actions/admin';
import { ConfirmDialog } from '@/components/admin/refund-dialog';
import { Button } from '@/components/ui/button';
import { LoadingPill } from '@/components/ui/loading-pill';
import { formatCents } from '@/lib/money';
import {
  RegistrantsTable,
  type RegistrantColumn,
  type RegistrantRow,
} from '@/components/admin/registrants-table';

/** Close the surrounding <dialog> once the action succeeds, so a successful
 * cancel/refund doesn't leave the modal open. Errors keep it open to show. */
function useCloseDialogOnSuccess(state: ActionResult) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.ok) return;
    const dialog = formRef.current?.closest('dialog');
    dialog?.close();
    window.location.reload();
    return () => dialog?.close();
  }, [state]);
  return formRef;
}

function CancelRegistrantForm({
  participantId,
  orderId,
}: {
  participantId: string;
  orderId: string;
}) {
  const [state, action, pending] = useActionState(cancelRegistrant, {});
  const formRef = useCloseDialogOnSuccess(state);
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="orderId" value={orderId} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? <LoadingPill className="bg-current/25" /> : 'Peruuta'}
      </Button>
    </form>
  );
}

function RefundRegistrantForm({
  participantId,
  amountCents,
}: {
  participantId: string;
  amountCents: number;
}) {
  const [state, action, pending] = useActionState(refundRegistrant, {});
  const formRef = useCloseDialogOnSuccess(state);
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? (
          <LoadingPill className="bg-current/25" />
        ) : (
          `Palauta ${formatCents(amountCents)}`
        )}
      </Button>
    </form>
  );
}

export function RegistrantsTableWithActions({
  rows,
  columns,
  fileName,
  canManage = true,
}: {
  rows: RegistrantRow[];
  columns: RegistrantColumn[];
  fileName: string;
  canManage?: boolean;
}) {
  function renderActions(row: RegistrantRow) {
    if (!canManage) return null;
    if (!row.participantId) return null;

    if (!row.participantCancelled) {
      return (
        <ConfirmDialog
          key="cancel"
          triggerLabel="Vahvista"
          triggerVariant="ghost"
          triggerSize="sm"
          title="Peru ilmoittautuminen"
          description={`${row.name}: Haluatko varmasti peruuttaa tämän ilmoittautumisen?`}
        >
          <CancelRegistrantForm participantId={row.participantId} orderId={row.orderId} />
        </ConfirmDialog>
      );
    }

    if (row.participantRefundedAt) {
      return (
        <Button variant="ghost" size="sm" disabled>
          Hyvitä
        </Button>
      );
    }

    if (
      row.participantCancelledAt &&
      row.orderPaidAt &&
      row.orderStripeSessionId &&
      row.participantPriceCents > 0
    ) {
      return (
        <ConfirmDialog
          key="refund"
          triggerLabel="Vahvista"
          triggerVariant="ghost"
          triggerSize="sm"
          title="Palauta maksu"
          description={`${row.name} — ${formatCents(row.participantPriceCents)}. Haluatko varmasti palauttaa maksun?`}
        >
          <RefundRegistrantForm
            participantId={row.participantId}
            amountCents={row.participantPriceCents}
          />
        </ConfirmDialog>
      );
    }

    return null;
  }

  const visibleColumns = canManage
    ? columns
    : columns.filter((column) => column.kind !== 'actions');

  return (
    <RegistrantsTable
      rows={rows}
      columns={visibleColumns}
      fileName={fileName}
      renderActions={renderActions}
    />
  );
}

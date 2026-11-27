'use client';

import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelRegistrant, refundRegistrant, type ActionResult } from '@/lib/actions/admin';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { formatCents } from '@/lib/money';
import {
  RegistrantsTable,
  type RegistrantColumn,
  type RegistrantRow,
} from '@/components/admin/registrants-table';

function CancelRegistrantForm({
  participantId,
  orderId,
  name,
}: {
  participantId: string;
  orderId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const router = useRouter();

  const [state, action, pending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await cancelRegistrant(prev, formData);
      if (result.ok) {
        setOpen(false);
        toast.success('Ilmoittautuminen peruttu', {
          description: `${name} on poistettu ilmoittautumisesta.`,
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
        Peru ilmoittautuminen
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Peru ilmoittautuminen"
        description={`${name}: Haluatko varmasti peruuttaa tämän ilmoittautumisen?`}
        confirmLabel="Peru ilmoittautuminen"
        cancelLabel="Älä peru"
        tone="destructive"
        onConfirm={() => formRef.current?.requestSubmit()}
        pending={pending}
        error={state.error}
      >
        <form ref={formRef} action={action}>
          <input type="hidden" name="participantId" value={participantId} />
          <input type="hidden" name="orderId" value={orderId} />
        </form>
      </ConfirmDialog>
    </>
  );
}

function RefundRegistrantForm({
  participantId,
  amountCents,
  name,
}: {
  participantId: string;
  amountCents: number;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const router = useRouter();

  const [state, action, pending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await refundRegistrant(prev, formData);
      if (result.ok) {
        setOpen(false);
        toast.success('Osallistumismaksu palautettu', {
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
        Hyvitä osallistumismaksu
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Palauta maksu"
        description={`${name} — ${formatCents(amountCents)}. Haluatko varmasti palauttaa maksun?`}
        confirmLabel={`Palauta ${formatCents(amountCents)}`}
        cancelLabel="Älä palauta"
        tone="destructive"
        onConfirm={() => formRef.current?.requestSubmit()}
        pending={pending}
        error={state.error}
      >
        <form ref={formRef} action={action}>
          <input type="hidden" name="participantId" value={participantId} />
        </form>
      </ConfirmDialog>
    </>
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
        <CancelRegistrantForm
          key="cancel"
          participantId={row.participantId}
          orderId={row.orderId}
          name={row.name}
        />
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
        <RefundRegistrantForm
          key="refund"
          participantId={row.participantId}
          amountCents={row.participantPriceCents}
          name={row.name}
        />
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

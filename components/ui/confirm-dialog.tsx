'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingPill } from '@/components/ui/loading-pill';
import { FormError } from '@/components/ui/field';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  error?: ReactNode;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Peruuta',
  tone = 'default',
  onConfirm,
  pending = false,
  error,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // A stray Enter must not confirm a destructive action, so focus the safe
  // button: cancel for destructive, confirm for neutral.
  useEffect(() => {
    if (!open) return;
    const target = tone === 'destructive' ? cancelRef.current : confirmRef.current;
    target?.focus();
  }, [open, tone]);

  function requestClose() {
    if (pending) return;
    onOpenChange(false);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) requestClose();
      }}
      onClose={() => onOpenChange(false)}
      className="fixed inset-0 m-auto w-[min(92vw,28rem)] rounded-lg border bg-card p-5 text-card-foreground shadow-lg backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-lg font-bold">
        {title}
      </h2>
      {description ? (
        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
      <FormError className="mt-3">{error}</FormError>
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <Button
          ref={cancelRef}
          type="button"
          variant="secondary"
          onClick={requestClose}
          disabled={pending}
        >
          {cancelLabel}
        </Button>
        <Button
          ref={confirmRef}
          type="button"
          variant={tone === 'destructive' ? 'destructive' : 'default'}
          onClick={() => void onConfirm()}
          disabled={pending}
        >
          {pending ? <LoadingPill className="bg-current/25" /> : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

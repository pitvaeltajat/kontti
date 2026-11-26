'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function ConfirmDialog({
  triggerLabel,
  triggerVariant = 'ghost',
  triggerSize = 'sm',
  title,
  description,
  children,
  open,
  onOpenChange,
}: {
  triggerLabel: string;
  triggerVariant?: 'ghost' | 'destructive' | 'default';
  triggerSize?: 'sm' | 'default';
  title: string;
  description: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open === undefined) return;
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  useEffect(() => {
    if (open !== undefined) return;
    dialog.current?.close();
  }, []);

  return (
    <>
      <Button
        type="button"
        size={triggerSize}
        variant={triggerVariant}
        onClick={() => {
          if (!dialog.current?.open) dialog.current?.showModal();
          onOpenChange?.(true);
        }}
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialog}
        aria-label={title}
        onClose={() => onOpenChange?.(false)}
        className="fixed inset-0 m-auto w-[min(92vw,28rem)] rounded-lg border bg-card p-5 text-card-foreground shadow-lg backdrop:bg-black/40"
      >
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 flex items-start justify-end gap-3">
          <form method="dialog">
            <Button type="submit" size="sm" variant="outline">
              Sulje
            </Button>
          </form>
          {children}
        </div>
      </dialog>
    </>
  );
}

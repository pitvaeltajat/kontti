'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';
import { LoadingPill } from '@/components/ui/loading-pill';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type ConfirmConfig = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
};

/**
 * Submit button for a server-action <form>. Shows a skeleton pill while the action is
 * in flight (so a click gives immediate feedback). With `confirm`, it opens a
 * ConfirmDialog first, so a destructive action isn't one stray tap away.
 */
export function FormButton({
  confirm,
  children,
  disabled,
  ...props
}: ButtonProps & { confirm?: string | ConfirmConfig }) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  if (!confirm) {
    return (
      <Button ref={buttonRef} type="submit" disabled={pending || disabled} {...props}>
        {pending ? <LoadingPill className="bg-current/25" /> : children}
      </Button>
    );
  }

  const config: ConfirmConfig =
    typeof confirm === 'string'
      ? {
          title: 'Vahvista toiminto',
          description: confirm,
          confirmLabel: 'Vahvista',
          tone: 'destructive',
        }
      : confirm;

  return (
    <>
      <Button
        {...props}
        ref={buttonRef}
        type="button"
        disabled={pending || disabled}
        onClick={() => setOpen(true)}
      >
        {pending ? <LoadingPill className="bg-current/25" /> : children}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={config.title}
        description={config.description}
        confirmLabel={config.confirmLabel ?? 'Vahvista'}
        cancelLabel={config.cancelLabel}
        tone={config.tone ?? 'destructive'}
        onConfirm={() => buttonRef.current?.form?.requestSubmit()}
        pending={pending}
      />
    </>
  );
}

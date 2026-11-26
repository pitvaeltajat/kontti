'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyableOrderRef({
  orderId,
  label = 'Tilausnumero',
}: {
  orderId: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const value = `#${orderId.slice(-8).toUpperCase()}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the value stays visible to copy by hand.
    }
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-md border bg-muted px-2 py-0.5 text-sm font-semibold">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        <span aria-live="polite">{copied ? 'Kopioitu' : 'Kopioi'}</span>
      </button>
    </span>
  );
}

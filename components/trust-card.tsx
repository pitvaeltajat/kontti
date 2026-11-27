import { CreditCard, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';

const paymentMethods = ['Kortti', 'Apple Pay', 'Google Pay', 'MobilePay', 'Verkkopankki'];

export function TrustCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-muted/50 p-3.5 sm:p-4', className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="size-4 text-success" aria-hidden="true" />
        Turvallinen maksu
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Maksun välittää Stripe. Korttitietojasi ei tallenneta Konttiin.
      </p>
      <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Maksutavat">
        {paymentMethods.map((method) => (
          <li
            key={method}
            className="inline-flex items-center gap-1 rounded border bg-card px-2 py-0.5 text-[0.72rem] font-semibold"
          >
            {method === 'Kortti' && (
              <CreditCard className="size-3.5 text-muted-foreground" aria-hidden="true" />
            )}
            {method}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.72rem] text-muted-foreground">
        Verkkopankki: OP, Nordea, Danske Bank, Säästöpankki, Aktia, S-Pankki, POP Pankki,
        Handelsbanken.
      </p>
    </div>
  );
}

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout';
import { loadStripe } from '@stripe/stripe-js';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cartStore } from '@/lib/cart';
import { formatCents } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingPill } from '@/components/ui/loading-pill';

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type PaymentAnswer = {
  questionId: string;
  prompt?: string;
  answer?: string | string[];
};

type PaymentLine = {
  name: string;
  variantName: string | null;
  priceCents: number;
  quantity: number;
  answers: PaymentAnswer[];
};

type PaymentData = {
  lines: PaymentLine[];
  totalCents: number;
  clientSecret: string;
};

export function CheckoutShell({ orderId }: { orderId: string | null }) {
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(orderId !== null);
  const [error, setError] = useState<string | null>(null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    fetch(`/api/orders/${encodeURIComponent(orderId)}/payment`)
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as Partial<PaymentData> & {
          error?: string;
          alreadyPaid?: boolean;
        };
        if (cancelled) return;
        if (!response.ok) {
          if (response.status === 410 && body.alreadyPaid) {
            setAlreadyPaid(true);
            return;
          }
          setError(body.error ?? 'Maksun tietoja ei voitu ladata.');
          return;
        }
        setData(body as PaymentData);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Maksun tietoja ei voitu ladata. Tarkista yhteys ja yritä uudelleen.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, reloadToken]);

  function retry() {
    setLoading(true);
    setError(null);
    setAlreadyPaid(false);
    setData(null);
    setReloadToken((value) => value + 1);
  }

  if (!orderId) {
    return (
      <StateCard
        icon={<AlertCircle className="size-12 text-destructive" />}
        title="Tilausta ei löydy."
        description="Maksulinkki on puutteellinen tai vanhentunut."
      >
        <ButtonLink href="/cart" variant="cta">
          Palaa ostoskoriin
        </ButtonLink>
      </StateCard>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-3">
          {[0, 1].map((index) => (
            <div key={index} className="rounded-lg border bg-card p-4 shadow-sm">
              <LoadingPill className="h-5 w-40 max-w-full bg-muted" />
              <LoadingPill className="mt-2 h-4 w-24 bg-muted" />
            </div>
          ))}
        </div>
        <div className="h-fit space-y-4 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
          <LoadingPill className="h-5 w-32 bg-muted" />
          <LoadingPill className="h-10 w-full bg-muted" />
          <LoadingPill className="h-10 w-full bg-muted" />
        </div>
      </div>
    );
  }

  if (alreadyPaid) {
    return (
      <StateCard
        icon={<CheckCircle2 className="size-12 text-success" />}
        title="Tilaus on jo maksettu."
        description="Tästä tilauksesta ei tarvitse maksaa uudelleen."
      >
        <ButtonLink href="/" variant="cta">
          Etusivulle
        </ButtonLink>
      </StateCard>
    );
  }

  if (error) {
    return (
      <StateCard
        icon={<AlertCircle className="size-12 text-destructive" />}
        title="Maksua ei voitu avata"
        description={error}
      >
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={retry}>
            Yritä uudelleen
          </Button>
          <ButtonLink href="/cart" variant="cta">
            Palaa ostoskoriin
          </ButtonLink>
        </div>
      </StateCard>
    );
  }

  if (!data) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <OrderSummary data={data} />
      <PaymentSection data={data} />
    </div>
  );
}

function StateCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          {icon}
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function OrderSummary({ data }: { data: PaymentData }) {
  return (
    <div className="space-y-3">
      {data.lines.map((line, index) => (
        <div key={index} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{line.name}</p>
              {line.variantName && (
                <p className="text-sm text-muted-foreground">{line.variantName}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {line.quantity} × {formatCents(line.priceCents)}
              </p>
            </div>
            <span className="shrink-0 font-semibold">
              {formatCents(line.priceCents * line.quantity)}
            </span>
          </div>
          {line.answers.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {line.answers.map((answer) => (
                <li key={answer.questionId}>
                  {answer.prompt}:{' '}
                  {Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <div className="flex items-baseline justify-between rounded-lg border bg-card p-4 shadow-sm">
        <span className="font-bold">Yhteensä</span>
        <span className="text-lg font-bold">{formatCents(data.totalCents)}</span>
      </div>
    </div>
  );
}

function PaymentSection({ data }: { data: PaymentData }) {
  return (
    <div className="h-fit space-y-4 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-bold">Maksaminen</h2>
      {!stripePromise ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Verkkomaksaminen ei ole juuri nyt käytössä.
        </p>
      ) : (
        <CheckoutElementsProvider
          stripe={stripePromise}
          options={{
            clientSecret: data.clientSecret,
            elementsOptions: {
              appearance: {
                theme: 'stripe',
                variables: { colorPrimary: 'hsl(244, 51%, 24%)', borderRadius: '6px' },
              },
            },
          }}
        >
          <MaksuPaymentForm />
        </CheckoutElementsProvider>
      )}
    </div>
  );
}

function MaksuPaymentForm() {
  const router = useRouter();
  const checkoutState = useCheckoutElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitPayment(event?: StripeExpressCheckoutElementConfirmEvent) {
    if (checkoutState.type !== 'success') {
      event?.paymentFailed({ message: 'Maksulomake ei ole vielä valmis. Yritä uudelleen.' });
      return;
    }
    const { checkout } = checkoutState;
    setError(null);
    setLoading(true);
    try {
      const result = await checkout.confirm({
        redirect: 'if_required',
        ...(event ? { expressCheckoutConfirmEvent: event } : {}),
      });
      if (result.type === 'error') {
        const failure = result.error as { type?: string; message?: string };
        if (failure.type === 'cancel') return;
        const message = failure.message ?? 'Maksu epäonnistui. Tarkista maksutiedot.';
        event?.paymentFailed({ message });
        setError(message);
        return;
      }
      fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: result.session.id }),
      }).catch(() => {
        // Silently ignore — webhook is the primary path
      });
      cartStore.clear();
      router.push(`/success?session_id=${encodeURIComponent(result.session.id)}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Maksu epäonnistui.';
      event?.paymentFailed({ message });
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <ExpressCheckoutElement
        options={{
          buttonHeight: 48,
          buttonType: { applePay: 'buy', googlePay: 'buy' },
          buttonTheme: { applePay: 'black', googlePay: 'black' },
          layout: { maxColumns: 2, maxRows: 1 },
          paymentMethodOrder: ['apple_pay', 'google_pay'],
          paymentMethods: { applePay: 'always', googlePay: 'always' },
        }}
        onConfirm={submitPayment}
      />
      <PaymentElement />
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <Button
        variant="cta"
        size="lg"
        className="w-full"
        disabled={loading || checkoutState.type !== 'success'}
        onClick={() => void submitPayment()}
      >
        {loading ? <LoadingPill className="bg-current/25" /> : 'Maksa'}
      </Button>
    </div>
  );
}

'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout';
import { loadStripe } from '@stripe/stripe-js';
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import { CheckCircle2, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, describedBy } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingPill } from '@/components/ui/loading-pill';
import { useToast } from '@/components/ui/toast';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EventPayment({
  token,
  eventName,
  dates,
  participants,
  total,
  status,
  registrationDeadline,
  canCancel,
}: {
  token: string;
  eventName: string;
  dates: string;
  participants: { id: string; name: string; cancelled: boolean }[];
  total: string;
  status: string;
  registrationDeadline: string | null;
  canCancel: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [parentEmail, setParentEmail] = useState('');
  const [parentEmailError, setParentEmailError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [cancelTarget, setCancelTarget] = useState<
    { kind: 'all' } | { kind: 'participant'; id: string; name: string } | null
  >(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // window.location only exists on the client. Reading it during render makes
  // the client output differ from the server HTML (the mailto href below), so
  // render the empty server snapshot first and let React swap in the real link
  // after hydration. Same pattern as KammiPayment.
  const url = useSyncExternalStore(
    () => () => {},
    () => window.location.href,
    () => '',
  );
  const message = useMemo(
    () =>
      `Hei! Olen ilmoittautunut partiotapahtumaan ${eventName}${dates ? ` (${dates})` : ''}. Hinta on ${total}. Voit maksaa ilmoittautumisen tästä: ${url}`,
    [dates, eventName, total, url],
  );

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: `Tapahtumamaksu: ${eventName}`, text: message });
      return;
    }
    await navigator.clipboard.writeText(message);
    toast.success('Linkki kopioitu', { description: 'Voit lähettää sen maksajalle.' });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    toast.success('Linkki kopioitu', { description: 'Voit lähettää sen maksajalle.' });
  }

  async function sendInstructions() {
    const email = parentEmail.trim();
    const validationError = EMAIL_RE.test(email) ? null : 'Anna kelvollinen sähköpostiosoite.';
    setParentEmailError(validationError);
    if (validationError) return;
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/event-payment/${encodeURIComponent(token)}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string; sent?: boolean };
      if (!response.ok || !data.sent) {
        setError(data.error ?? 'Maksuohjetta ei voitu lähettää.');
        return;
      }
      toast.info('Maksuohje lähetetty', { description: email });
      setParentEmail('');
    } catch {
      setError('Maksuohjetta ei voitu lähettää. Tarkista yhteys ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }

  async function openPayment() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/event-payment/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as {
        clientSecret?: string;
        error?: string;
        alreadyPaid?: boolean;
      };
      if (!response.ok || !data.clientSecret) {
        setError(
          data.alreadyPaid
            ? 'Tämä ilmoittautuminen on jo maksettu.'
            : (data.error ?? 'Maksua ei voitu aloittaa.'),
        );
        return;
      }
      setClientSecret(data.clientSecret);
    } catch {
      setError('Maksua ei voitu aloittaa. Tarkista yhteys ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }

  const paid = currentStatus === 'PAID' || currentStatus === 'COMPLETED';
  const cancelled = currentStatus === 'CANCELLED';

  function openCancelAll() {
    setCancelError(null);
    setCancelTarget({ kind: 'all' });
  }

  function openCancelParticipant(id: string, name: string) {
    setCancelError(null);
    setCancelTarget({ kind: 'participant', id, name });
  }

  async function confirmCancel() {
    const target = cancelTarget;
    if (!target) return;
    setCancelError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/event-payment/${encodeURIComponent(token)}/cancel`, {
        method: 'POST',
        ...(target.kind === 'all'
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ participantId: target.id }),
            }),
      });
      const data = (await response.json()) as {
        error?: string;
        cancelled?: boolean;
        orderCancelled?: boolean;
      };
      if (!response.ok || !data.cancelled) {
        setCancelError(data.error ?? 'Ilmoittautumista ei voitu perua.');
        return;
      }
      if (target.kind === 'all') {
        setCurrentStatus('CANCELLED');
        toast.success(
          participants.length > 1 ? 'Ilmoittautumiset peruttu' : 'Ilmoittautuminen peruttu',
          { description: 'Maksulinkki ei ole enää käytettävissä.' },
        );
      } else {
        if (data.orderCancelled) setCurrentStatus('CANCELLED');
        toast.success('Ilmoittautuminen peruttu', {
          description: `${target.name} on poistettu ilmoittautumisesta.`,
        });
      }
      setCancelTarget(null);
      router.refresh();
    } catch {
      setCancelError('Ilmoittautumista ei voitu perua. Tarkista yhteys ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }

  const cancelAll = cancelTarget?.kind === 'all';
  const cancelTitle = cancelAll
    ? participants.length > 1
      ? 'Peru kaikki ilmoittautumiset'
      : 'Peru ilmoittautuminen'
    : 'Peru ilmoittautuminen';
  const cancelDescription = cancelAll
    ? participants.length > 1
      ? 'Perutaanko kaikki ilmoittautumiset? Tätä ei voi palauttaa tästä linkistä.'
      : 'Perutaanko ilmoittautuminen? Tätä ei voi palauttaa tästä linkistä.'
    : cancelTarget
      ? `Perutaanko ${cancelTarget.name}? Tätä ei voi palauttaa tästä linkistä.`
      : 'Perutaanko ilmoittautuminen? Tätä ei voi palauttaa tästä linkistä.';
  const cancelConfirmLabel =
    cancelAll && participants.length > 1 ? 'Peru kaikki ilmoittautumiset' : 'Peru ilmoittautuminen';

  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader className="items-center text-center">
          {paid ? (
            <CheckCircle2 className="size-12 text-success" />
          ) : (
            <Share2 className="size-12 text-primary" />
          )}
          <CardTitle>
            {paid
              ? 'Ilmoittautuminen on maksettu'
              : cancelled
                ? 'Ilmoittautuminen on peruttu'
                : 'Tapahtumamaksu'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border p-4 text-sm">
            <p className="font-semibold">{eventName}</p>
            {dates && <p className="text-muted-foreground">{dates}</p>}
            {participants.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="font-medium">Osallistujat</p>
                <ul className="space-y-1">
                  {participants.map((participant) => (
                    <li
                      key={participant.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span
                        className={
                          participant.cancelled ? 'text-muted-foreground line-through' : undefined
                        }
                      >
                        {participant.name}
                        {participant.cancelled && (
                          <span className="ml-1 no-underline">(peruttu)</span>
                        )}
                      </span>
                      {!participant.cancelled &&
                        !cancelled &&
                        canCancel &&
                        participants.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => openCancelParticipant(participant.id, participant.name)}
                            disabled={loading}
                          >
                            Peru ilmoittautuminen
                          </Button>
                        )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-2 text-lg font-bold">{total}</p>
          </div>

          {!paid && !cancelled && (
            <div className="space-y-4">
              <section className="space-y-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-5">
                <div>
                  <h2 className="text-lg font-bold">Osallistujalle</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ilmoittautuminen on vastaanotettu. Jaa maksuohje vanhemmalle, jotta hän voi
                    maksaa omalla laitteellaan.
                  </p>
                </div>
                <Button type="button" variant="cta" className="w-full" onClick={share}>
                  <Share2 className="size-4" /> Jaa maksuohje
                </Button>
                <div className="grid gap-2">
                  <Button type="button" variant="outline" onClick={copyLink}>
                    <Copy className="size-4" /> Kopioi linkki
                  </Button>
                </div>
                <div className="space-y-2 border-t border-primary/15 pt-3">
                  <Field
                    label="Tai lähetä maksuohje sähköpostiin"
                    htmlFor="parent-email"
                    hint="Maksuohje lähetetään tähän osoitteeseen."
                    error={parentEmailError}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="parent-email"
                        type="email"
                        value={parentEmail}
                        onChange={(e) => {
                          setParentEmail(e.target.value);
                          if (parentEmailError) {
                            setParentEmailError(
                              EMAIL_RE.test(e.target.value.trim())
                                ? null
                                : 'Anna kelvollinen sähköpostiosoite.',
                            );
                          }
                        }}
                        placeholder="huoltaja@esimerkki.com"
                        aria-invalid={parentEmailError ? true : undefined}
                        aria-describedby={describedBy('parent-email', {
                          hint: true,
                          error: Boolean(parentEmailError),
                        })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={sendInstructions}
                        disabled={loading}
                      >
                        Lähetä ohje
                      </Button>
                    </div>
                  </Field>
                </div>
              </section>

              <section className="space-y-4 rounded-lg border p-5">
                <div>
                  <h2 className="text-lg font-bold">Vanhemmalle</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Avaa maksuohje ja maksa ilmoittautuminen. Maksu vahvistaa osallistumisen.
                  </p>
                </div>
                {!clientSecret && (
                  <Button
                    type="button"
                    variant="cta"
                    className="w-full"
                    onClick={openPayment}
                    disabled={loading || !stripePromise}
                  >
                    {loading ? <LoadingPill className="bg-current/25" /> : 'Maksa nyt'}
                  </Button>
                )}
                {clientSecret && stripePromise && (
                  <CheckoutElementsProvider
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      elementsOptions: { appearance: { theme: 'stripe' } },
                    }}
                  >
                    <EventPaymentForm />
                  </CheckoutElementsProvider>
                )}
              </section>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
          {paid && (
            <p className="text-center text-sm text-muted-foreground">
              Maksu on vastaanotettu ja ilmoittautuminen vahvistettu. Voit perua ilmoittautumisen
              Ilmoittautumisajan loppuun asti. Maksun palautus käsitellään ylläpidossa.
            </p>
          )}
          {!cancelled && canCancel && (
            <section className="space-y-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Ilmoittautumisen voi perua {registrationDeadline ?? 'ilmoittautumisen määräaikaan'}{' '}
                mennessä. Maksun palautus käsitellään ylläpidossa.
              </p>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                onClick={openCancelAll}
                disabled={loading}
              >
                {participants.length > 1 ? 'Peru kaikki ilmoittautumiset' : 'Peru ilmoittautuminen'}
              </Button>
            </section>
          )}
          {!cancelled && !canCancel && (
            <p className="border-t pt-4 text-center text-sm text-muted-foreground">
              Ilmoittautuminen on päättynyt. Ilmoittautumista ei voi enää perua tämän linkin kautta.
            </p>
          )}
          {cancelled && (
            <p className="text-center text-sm text-muted-foreground">
              Ilmoittautuminen on peruttu. Maksulinkki ei ole enää käytettävissä.
            </p>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title={cancelTitle}
        description={cancelDescription}
        confirmLabel={cancelConfirmLabel}
        cancelLabel="Älä peru"
        tone="destructive"
        pending={loading}
        error={cancelError}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

function EventPaymentForm() {
  const router = useRouter();
  const checkoutState = useCheckoutElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(expressCheckoutConfirmEvent?: StripeExpressCheckoutElementConfirmEvent) {
    if (checkoutState.type !== 'success') {
      expressCheckoutConfirmEvent?.paymentFailed({
        message: 'Maksulomake ei ole vielä valmis. Yritä uudelleen.',
      });
      return;
    }
    const { checkout } = checkoutState;
    setError(null);
    setLoading(true);
    try {
      const result = await checkout.confirm({
        redirect: 'if_required',
        ...(expressCheckoutConfirmEvent ? { expressCheckoutConfirmEvent } : {}),
      });
      if (result.type === 'error') {
        expressCheckoutConfirmEvent?.paymentFailed({ message: result.error.message });
        setError(result.error.message ?? 'Maksu epäonnistui.');
        return;
      }
      fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: result.session.id }),
      }).catch(() => {});
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Maksu epäonnistui.';
      expressCheckoutConfirmEvent?.paymentFailed({ message });
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <ExpressCheckoutElement
        options={{
          buttonHeight: 48,
          buttonType: { applePay: 'buy', googlePay: 'buy' },
          buttonTheme: { applePay: 'black', googlePay: 'black' },
          layout: { maxColumns: 2, maxRows: 1 },
          paymentMethodOrder: ['apple_pay', 'google_pay'],
          paymentMethods: { applePay: 'always', googlePay: 'always' },
        }}
        onConfirm={(event) => void submit(event)}
      />
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        variant="cta"
        className="w-full"
        onClick={() => void submit()}
        disabled={loading || checkoutState.type !== 'success'}
      >
        {loading ? <LoadingPill className="bg-current/25" /> : 'Maksa'}
      </Button>
    </div>
  );
}

import type { Metadata } from 'next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { toISODate } from '@/lib/kammi';
import { KammiPayment } from '@/components/kammi-payment';
import { PaymentLinkExpired } from '@/components/payment-link-expired';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Kammin maksu' };

export default async function KammiPaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await prisma.kammiBooking.findUnique({ where: { paymentToken: token } });
  if (!booking) return <PaymentLinkExpired />;
  if (booking.status === 'CONFIRMED') {
    return (
      <div className="container flex justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="size-12 text-success" />
            <CardTitle>Varaus on jo maksettu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Tämä varaus on jo vahvistettu ja maksettu. Ovikoodi ja ohjeet on lähetetty
              sähköpostiisi.
            </p>
            <ButtonLink href="/kammi" variant="cta">
              Takaisin varauskalenteriin
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (booking.status === 'CANCELLED') {
    return (
      <div className="container flex justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <XCircle className="size-12 text-destructive" />
            <CardTitle>Varaus on peruttu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Tämä varaus on peruttu, eikä sitä voi enää maksaa.
            </p>
            <ButtonLink href="/kammi" variant="cta">
              Takaisin varauskalenteriin
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <KammiPayment
      token={token}
      name={booking.name ?? 'Varaus'}
      start={toISODate(booking.startDate)}
      end={toISODate(booking.endDate)}
      nights={booking.nights}
      total={formatCents(booking.totalCents)}
      holdExpiresAt={booking.holdExpiresAt?.toISOString() ?? null}
    />
  );
}

import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Kiitos varauksesta' };

export default async function KammiThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  const free = status === 'free';

  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="size-12 text-success" />
          <CardTitle>{free ? 'Varaus vahvistettu' : 'Maksu onnistui'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            {free
              ? 'Pitkäjärven Vaeltajien jäsenen varaus on maksuton. Ovikoodi ja ohjeet on lähetetty sähköpostiisi.'
              : 'Varaus on vahvistettu. Ovikoodi ja ohjeet on lähetetty sähköpostiisi.'}
          </p>
          <ButtonLink href="/kammi" variant="cta">
            Takaisin varauskalenteriin
          </ButtonLink>
        </CardContent>
      </Card>
    </div>
  );
}

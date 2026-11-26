import type { Metadata } from 'next';
import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Sivua ei löytynyt' };

export default function NotFound() {
  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Compass className="size-12 text-primary" />
          <CardTitle>Sivua ei löytynyt</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Etsimääsi sivua ei ole olemassa tai se on siirretty. Tarkista osoite tai palaa
            etusivulle.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/" variant="cta">
              Takaisin etusivulle
            </ButtonLink>
            <ButtonLink href="/cart" variant="outline">
              Ostoskoriin
            </ButtonLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

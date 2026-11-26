'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <AlertTriangle className="size-12 text-destructive" />
          <CardTitle>Jotain meni pieleen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Tapahtui odottamaton virhe. Yritä ladata sivu uudelleen. Jos ongelma jatkuu, ota
            yhteyttä: info@pitkajarvenvaeltajat.fi.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="cta" onClick={retry}>
              Yritä uudelleen
            </Button>
            <ButtonLink href="/" variant="outline">
              Takaisin etusivulle
            </ButtonLink>
          </div>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Virhekoodi: {error.digest}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

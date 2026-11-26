import { Link2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export function PaymentLinkExpired() {
  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Link2 className="size-12 text-warning" />
          <CardTitle>Maksulinkki ei ole enää voimassa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Tämä maksulinkki on vanhentunut tai se on jo käytetty. Pyydä uusi linkki
            ilmoittautumisen tehneeltä henkilöltä.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/" variant="cta">
              Takaisin etusivulle
            </ButtonLink>
            <a
              href="mailto:info@pitkajarvenvaeltajat.fi"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              Pyydä uusi linkki
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogOut, ShieldAlert } from 'lucide-react';
import { auth, signOut } from '@/lib/auth';
import { getUserRole, isSuperAdmin, isDevLoginEnabled } from '@/lib/admin';
import { LoginForm } from '@/components/login-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Kirjaudu sisään' };

function BrandHeader() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2 text-center">
      <div className="grid size-12 place-items-center rounded-lg bg-cta text-lg font-extrabold text-cta-foreground">
        K
      </div>
      <p className="text-lg font-bold">Kontti</p>
      <p className="text-sm text-muted-foreground">
        Pitkäjärven Vaeltajien kauppa ja ilmoittautumisportaali.
      </p>
    </div>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const safeCallback =
    typeof callbackUrl === 'string' && callbackUrl.startsWith('/') ? callbackUrl : '/';

  const session = await auth();
  const email = session?.user?.email ?? null;
  // Only superadmins reach the app while the shop is "kesken".
  if (email && isSuperAdmin(await getUserRole(email))) {
    redirect(safeCallback);
  }

  // Signed in but not a superadmin, including a shared .pitva.fi cookie from
  // another pitva app. The shop isn't open to them yet.
  if (email) {
    return (
      <div className="container flex flex-col items-center py-12">
        <BrandHeader />
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <ShieldAlert className="size-10 text-warning" />
            <CardTitle>Kontti on vielä työn alla</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
            <p>
              Tilillä {email} ei ole vielä pääsyä Konttiin. Palvelu on toistaiseksi vain
              pääylläpitäjien käytössä. Pyydä lippukunnan ATK-vastaavaa lisäämään käyttöoikeus.
            </p>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
              className="flex justify-center"
            >
              <Button type="submit" variant="outline">
                <LogOut /> Vaihda tiliä
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex flex-col items-center py-12">
      <BrandHeader />
      <LoginForm devEnabled={isDevLoginEnabled()} callbackUrl={safeCallback} />
    </div>
  );
}

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserRole, isSuperAdmin } from '@/lib/admin';
import { getSession } from '@/lib/session';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ToastProvider } from '@/components/ui/toast';
import '@/styles/globals.css';

// The catalog is read from Postgres on every request, so nothing here is
// prerendered at build time (the build server has no database).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://kontti.pitva.fi'),
  title: {
    default: 'Kontti · Pitkäjärven Vaeltajat',
    template: '%s · Kontti',
  },
  description:
    'Pitkäjärven Vaeltajien tuotteet ja tapahtumailmoittautumiset samassa paikassa. Tilaa huiveja, merkkejä ja muita PitVa-tuotteita tai ilmoittaudu tapahtumiin.',
  openGraph: {
    type: 'website',
    locale: 'fi_FI',
    siteName: 'Kontti · Pitkäjärven Vaeltajat',
    title: 'Kontti · Pitkäjärven Vaeltajat',
    description: 'Pitkäjärven Vaeltajien nettikauppa ja ilmoittautumisportaali.',
    url: '/',
    images: [
      { url: '/opengraph-image', width: 1200, height: 630, alt: 'Kontti · Pitkäjärven Vaeltajat' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kontti · Pitkäjärven Vaeltajat',
    description: 'Pitkäjärven Vaeltajien nettikauppa ja ilmoittautumisportaali.',
    images: ['/opengraph-image'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const email = session?.user?.email ?? null;
  // Read the role from kontti's own database, not the session token. A shared
  // .pitva.fi cookie from another pitva app carries that app's role claim.
  const role = email ? await getUserRole(email) : null;
  const superAdmin = isSuperAdmin(role);

  const pathname = (await headers()).get('x-pathname') ?? '';

  // "Kesken": only superadmins reach the app. Everyone else goes to /login,
  // which renders bare: nothing but the Google button, no shop chrome.
  if (!superAdmin && pathname !== '/login') {
    redirect('/login');
  }

  if (!superAdmin) {
    return (
      <html lang="fi">
        <body>
          <ToastProvider>
            <main className="flex min-h-screen flex-col justify-center">{children}</main>
          </ToastProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="fi">
      <body>
        <ToastProvider>
          <div className="flex min-h-screen flex-col">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring"
            >
              Siirry sisältöön
            </a>
            <SiteHeader role={role ?? undefined} pathname={pathname} />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}

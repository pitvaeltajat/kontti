'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingPill } from '@/components/ui/loading-pill';

export function LoginForm({
  devEnabled,
  callbackUrl,
}: {
  devEnabled: boolean;
  callbackUrl: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function googleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await signIn('google', { callbackUrl });
    } catch {
      setError('Kirjautuminen epäonnistui. Yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }

  async function devSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn('dev-login', { email, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) {
      setError('Kirjautuminen epäonnistui. Tarkista sähköpostiosoite.');
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Kirjaudu sisään</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button className="w-full" variant="cta" onClick={googleSignIn} disabled={loading}>
          {loading ? <LoadingPill /> : 'Jatka Google-tilillä'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Käytämme Google-tiliä vain kirjautumiseen. Emme näe salasanaasi.
        </p>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {devEnabled && (
          <form onSubmit={devSignIn} className="space-y-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Kehitystila: kirjaudu sisään sähköpostilla ilman salasanaa.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="dev-email">Sähköposti</Label>
              <Input
                id="dev-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="etunimi@example.com"
              />
            </div>
            <Button type="submit" variant="outline" disabled={loading || !email.includes('@')}>
              {loading ? <LoadingPill className="bg-current/25" /> : 'Kirjaudu (kehitys)'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

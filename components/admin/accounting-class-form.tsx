'use client';

import { useEffect } from 'react';
import { useActionState } from 'react';
import { saveAccountingClass } from '@/lib/actions/admin';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingPill } from '@/components/ui/loading-pill';
import { useToast } from '@/components/ui/toast';

export function AccountingClassForm() {
  const [state, action, pending] = useActionState(saveAccountingClass, undefined);
  const { success } = useToast();

  useEffect(() => {
    if (state?.ok) success('Kirjanpitoluokka lisätty');
  }, [state, success]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      <Field label="Nimi" htmlFor="accounting-class-name" required className="min-w-60 flex-1">
        <Input id="accounting-class-name" name="name" placeholder="esim. 4010 Varusteet" required />
      </Field>
      <Field label="Järjestys" htmlFor="accounting-class-order" className="w-28">
        <Input id="accounting-class-order" name="sortOrder" type="number" defaultValue="0" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? <LoadingPill className="bg-current/25" /> : 'Lisää luokka'}
      </Button>
      <FormError className="basis-full text-sm">{state?.error}</FormError>
    </form>
  );
}

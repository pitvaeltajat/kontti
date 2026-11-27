'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { saveCategory } from '@/lib/actions/admin';
import { Button } from '@/components/ui/button';
import { Field, FormError, describedBy } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoadingPill } from '@/components/ui/loading-pill';

export type CategoryFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export function CategoryForm({ category }: { category?: CategoryFormValues }) {
  const [state, action, pending] = useActionState(saveCategory, undefined);
  const [name, setName] = useState(category?.name ?? '');
  const [touched, setTouched] = useState({ name: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const nameInvalid = !name.trim();
  const nameError =
    (touched.name || submitAttempted) && nameInvalid ? 'Anna kategorialle nimi.' : undefined;
  const formError = submitAttempted && nameInvalid ? 'Tarkista merkityt kentät.' : undefined;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setTouched({ name: true });
    setSubmitAttempted(true);
    if (nameInvalid) {
      event.preventDefault();
      document.getElementById('category-name')?.focus();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-5">
      <FormError className="rounded-md bg-destructive/10 px-3 py-2 text-sm">
        {state?.error ?? formError}
      </FormError>
      {category?.id && <input type="hidden" name="id" value={category.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nimi" htmlFor="category-name" required error={nameError}>
          <Input
            id="category-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched({ name: true })}
            aria-required="true"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={describedBy('category-name', { error: Boolean(nameError) })}
          />
        </Field>
        <Field
          label="Tunnus URL-osoitteessa"
          htmlFor="category-slug"
          hint={
            <>
              Kategorian osoite: <span className="font-mono">/category/{'{slug}'}</span>. Jätä
              tyhjäksi, niin tunnus muodostetaan nimestä. Käytä pieniä kirjaimia, numeroita ja
              väliviivoja (ä→a, ö→o).
            </>
          }
        >
          <Input
            id="category-slug"
            name="slug"
            defaultValue={category?.slug ?? ''}
            placeholder="muodostetaan-nimesta"
            spellCheck={false}
            autoCapitalize="none"
            aria-describedby={describedBy('category-slug', { hint: true })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Järjestysnumero" htmlFor="category-sort-order">
          <Input
            id="category-sort-order"
            name="sortOrder"
            type="number"
            step="1"
            inputMode="numeric"
            defaultValue={category?.sortOrder ?? 0}
          />
        </Field>
      </div>

      <Field label="Kuvaus" htmlFor="category-description">
        <Textarea
          id="category-description"
          name="description"
          rows={3}
          defaultValue={category?.description ?? ''}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? (
          <LoadingPill className="bg-current/25" />
        ) : category ? (
          'Tallenna kategoria'
        ) : (
          'Luo kategoria'
        )}
      </Button>
    </form>
  );
}

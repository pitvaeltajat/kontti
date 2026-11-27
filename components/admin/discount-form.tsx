'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { saveDiscount } from '@/lib/actions/admin';
import { LEADER_DISCOUNT_CODE, LEADER_DISCOUNT_PERCENT } from '@/lib/discount';
import { Button } from '@/components/ui/button';
import { Field, FormError, describedBy } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoadingPill } from '@/components/ui/loading-pill';

export type DiscountFormValues = {
  id?: string;
  code: string;
  description: string;
  percentOff: number;
  active: boolean;
  /** "YYYY-MM-DD" for the native date input, or null. */
  validUntil: string | null;
};

const CODE_PATTERN = /^[A-ZÅÄÖ0-9]{2,32}$/;

export function DiscountForm({ discount }: { discount?: DiscountFormValues }) {
  const [state, action, pending] = useActionState(saveDiscount, undefined);
  const [code, setCode] = useState(discount?.code ?? LEADER_DISCOUNT_CODE);
  const [percentOff, setPercentOff] = useState(
    String(discount?.percentOff ?? LEADER_DISCOUNT_PERCENT),
  );
  const [touched, setTouched] = useState({ code: false, percentOff: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const codeInvalid = !CODE_PATTERN.test(code.trim().toUpperCase());
  const percentValue = Number(percentOff);
  const percentInvalid = !Number.isInteger(percentValue) || percentValue < 1 || percentValue > 100;
  const codeError =
    (touched.code || submitAttempted) && codeInvalid
      ? 'Koodi: 2–32 kirjainta tai numeroa (ei välilyöntejä).'
      : undefined;
  const percentError =
    (touched.percentOff || submitAttempted) && percentInvalid
      ? 'Alennusprosentti on 1–100.'
      : undefined;
  const formError =
    submitAttempted && (codeInvalid || percentInvalid) ? 'Tarkista merkityt kentät.' : undefined;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setTouched({ code: true, percentOff: true });
    setSubmitAttempted(true);
    if (codeInvalid || percentInvalid) {
      event.preventDefault();
      document.getElementById(codeInvalid ? 'discount-code' : 'discount-percent')?.focus();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-5">
      <FormError className="rounded-md bg-destructive/10 px-3 py-2 text-sm">
        {state?.error ?? formError}
      </FormError>
      {discount?.id && <input type="hidden" name="id" value={discount.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Koodi"
          htmlFor="discount-code"
          required
          hint="Ostaja kirjoittaa tämän ostoskorissa. Isot kirjaimet ja numerot."
          error={codeError}
        >
          <Input
            id="discount-code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, code: true }))}
            placeholder="JOHTAJA"
            spellCheck={false}
            autoCapitalize="characters"
            className="font-mono uppercase"
            aria-required="true"
            aria-invalid={codeError ? true : undefined}
            aria-describedby={describedBy('discount-code', {
              hint: true,
              error: Boolean(codeError),
            })}
          />
        </Field>
        <Field label="Alennus (%)" htmlFor="discount-percent" required error={percentError}>
          <Input
            id="discount-percent"
            name="percentOff"
            type="number"
            min="1"
            max="100"
            step="1"
            inputMode="numeric"
            value={percentOff}
            onChange={(event) => setPercentOff(event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, percentOff: true }))}
            placeholder={String(LEADER_DISCOUNT_PERCENT)}
            aria-required="true"
            aria-invalid={percentError ? true : undefined}
            aria-describedby={describedBy('discount-percent', {
              error: Boolean(percentError),
            })}
          />
        </Field>
      </div>

      <Field label="Kuvaus (vain hallinnassa)" htmlFor="discount-description">
        <Textarea
          id="discount-description"
          name="description"
          rows={2}
          defaultValue={discount?.description ?? ''}
          placeholder="Esim. Johtajien alennus tapahtumiin."
        />
      </Field>

      <Field
        label="Voimassa asti (valinnainen)"
        htmlFor="discount-valid-until"
        hint="Tyhjä = ei päättymispäivää."
      >
        <Input
          id="discount-valid-until"
          name="validUntil"
          type="date"
          defaultValue={discount?.validUntil ?? ''}
          aria-describedby={describedBy('discount-valid-until', { hint: true })}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={discount?.active ?? true}
          className="size-4 accent-[hsl(244,51%,24%)]"
        />
        Käytössä
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? (
          <LoadingPill className="bg-current/25" />
        ) : discount ? (
          'Tallenna koodi'
        ) : (
          'Luo koodi'
        )}
      </Button>
    </form>
  );
}

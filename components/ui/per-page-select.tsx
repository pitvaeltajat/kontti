'use client';

import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';

export type PerPageSelectProps = {
  value: number;
  options: number[];
  name: string;
  hrefs: Record<number, string>;
  label: string;
};

export function PerPageSelect({ value, options, name, hrefs, label }: PerPageSelectProps) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{label}</span>
      <Select
        name={name}
        value={value}
        onChange={(event) => {
          const href = hrefs[Number(event.target.value)];
          if (href) router.push(href);
        }}
        className="h-8 w-auto"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </label>
  );
}

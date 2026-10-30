'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ComponentProps, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { th } from '@/lib/content/th';
import {
  parseJoin,
  parseUnits,
  type JoinErrors,
  type JoinForm as Fields,
} from '@/lib/practice/join';
import { profileStore } from '@/lib/practice/store';
import { useProfile } from './useProfile';

interface FieldProps extends ComponentProps<'input'> {
  label: string;
  help?: string;
  error?: string;
}

// The one screen with system-keyboard fields: a class code and a nickname have letters in them, and
// none of this is an answer, so the keypad rule (CLAUDE.md, rule 8) does not apply here.
function Field({ label, help, error, ...input }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={help || error ? noteId : undefined}
        autoComplete="off"
        className={`h-12 rounded-xl border-2 bg-surface px-3 text-base outline-none focus:border-brand ${
          error ? 'border-warn' : 'border-line'
        }`}
        {...input}
      />
      {(help || error) && (
        <p id={noteId} className={`text-sm ${error ? 'text-warn' : 'text-muted'}`}>
          {error ?? help}
        </p>
      )}
    </div>
  );
}

const unitsParam = () => new URLSearchParams(window.location.search).get('units');

export function JoinForm() {
  const router = useRouter();
  const current = useProfile();
  const [fields, setFields] = useState<Fields>({ code: '', seat: '', nickname: '' });
  const [errors, setErrors] = useState<JoinErrors>({});

  // Someone already signed in goes on to their map; its leave button brings the form back.
  useEffect(() => {
    if (current && unitsParam() === null) router.replace('/learn');
  }, [current, router]);

  const set = (name: keyof Fields) => (event: { target: { value: string } }) =>
    setFields({ ...fields, [name]: event.target.value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const units = parseUnits(unitsParam());
    const result = parseJoin(fields, units);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    profileStore.open(result.student, { keepUnits: units === null });
    router.replace('/learn');
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{th.join.title}</h1>
        <Field
          label={th.join.codeLabel}
          help={th.join.codeHelp}
          error={errors.code && th.join.errors.code}
          value={fields.code}
          onChange={set('code')}
          maxLength={6}
          autoCapitalize="characters"
          spellCheck={false}
        />
        <Field
          label={th.join.seatLabel}
          error={errors.seat && th.join.errors.seat}
          value={fields.seat}
          onChange={set('seat')}
          maxLength={2}
          inputMode="numeric"
        />
        <Field
          label={th.join.nicknameLabel}
          error={errors.nickname && th.join.errors.nickname}
          value={fields.nickname}
          onChange={set('nickname')}
        />
        <Button type="submit">{th.join.submit}</Button>
        <p className="text-center text-sm text-muted">{th.join.localNote}</p>
      </form>
    </main>
  );
}

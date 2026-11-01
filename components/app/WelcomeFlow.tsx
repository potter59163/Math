'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { Button, LinkButton } from '@/components/ui/Button';
import { CheckIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { ThemeId } from '@/lib/learner/types';
import { testBlock } from '@/lib/sync/assessment';
import { MAX_DISPLAY_NAME, THEMES, type AvatarId } from '@/lib/sync/types';
import { AvatarPicker } from './Avatar';
import { savedCohort } from './Landing';
import { Mascot } from './Mascot';
import { learner, useLearner } from './useLearner';

type Step = 'name' | 'theme' | 'consent' | 'pretest';

export function ThemePicker({ value, onPick }: { value: ThemeId; onPick(theme: ThemeId): void }) {
  return (
    <div role="radiogroup" aria-label={th.settings.theme} className="flex flex-col gap-2">
      {THEMES.map((theme) => (
        <button
          key={theme}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => onPick(theme)}
          className={`flex min-h-14 items-center justify-between gap-2 rounded-2xl border-2 px-4 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            theme === value ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
          }`}
        >
          <span>
            <span className="block font-bold">{th.themes[theme].name}</span>
            <span className="block text-sm text-muted">{th.themes[theme].hint}</span>
          </span>
          {theme === value && <CheckIcon className="size-5 shrink-0 text-brand" />}
        </button>
      ))}
    </div>
  );
}

/** The first visit: for an account a name, a theme and consent, and for a guest only the theme. */
export function WelcomeFlow() {
  const { phase, mode } = useLearner();
  const router = useRouter();
  const guest = useSearchParams().has('guest');
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('bracket');
  const [theme, setTheme] = useState<ThemeId>('shop');
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const nameId = useId();
  const noteId = `${nameId}-note`;

  const asGuest = guest && phase !== 'needs_welcome';

  // Whoever has nothing to do here moves on. A student finishing just now stays for the last step.
  useEffect(() => {
    if (step === 'pretest' || saving) return;
    if (phase === 'signed_out' && !guest) router.replace('/');
    if (phase === 'ready' && mode === 'account') router.replace('/learn');
  }, [phase, mode, guest, step, saving, router]);

  const shown = asGuest ? 'theme' : step;
  const stepNumber = { name: 1, theme: 2, consent: 3, pretest: 3 }[shown];
  const trimmed = name.trim();
  const tooLong = trimmed.length > MAX_DISPLAY_NAME;

  const finish = async () => {
    setSaving(true);
    setFailed(false);
    const cohort = savedCohort();
    const done = await learner.finishWelcome({
      displayName: trimmed,
      avatar,
      theme,
      ...(cohort && { cohort }),
    });
    setSaving(false);
    if (!done) setFailed(true);
    // Whoever practised as a guest first has no start left for a pre-test to measure, and moves on.
    else if (!testBlock('pre', learner.getState().profile?.itemsDone ?? 0)) setStep('pretest');
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6">
      {!asGuest && shown !== 'pretest' && (
        <p className="text-center text-sm font-semibold text-muted">
          {fillTokens(th.welcome.step, { n: String(stepNumber), total: '3' })}
        </p>
      )}
      <div className="flex justify-center">
        <Mascot className="size-16" mood={shown === 'pretest' ? 'cheer' : 'happy'} />
      </div>

      {shown === 'name' && (
        <section className="flex flex-1 flex-col gap-4 motion-safe:animate-rise">
          <h1 className="text-center text-2xl font-bold">{th.welcome.nameTitle}</h1>
          <div className="flex flex-col gap-1">
            <label htmlFor={nameId} className="font-medium">
              {th.welcome.nameLabel}
            </label>
            {/* A name has letters in it and is not an answer, so the keypad rule does not apply. */}
            <input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={tooLong}
              aria-describedby={noteId}
              autoComplete="off"
              className="h-12 rounded-xl border-2 border-edge bg-surface px-3 text-base outline-none focus:border-brand"
            />
            <p id={noteId} className={`text-sm ${tooLong ? 'text-warn' : 'text-muted'}`}>
              {tooLong
                ? fillTokens(th.welcome.nameTooLong, { max: String(MAX_DISPLAY_NAME) })
                : th.welcome.nameHelp}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-medium">{th.welcome.avatarTitle}</h2>
            <AvatarPicker value={avatar} label={th.welcome.avatarTitle} onPick={setAvatar} />
          </div>
          <Button
            className="mt-auto w-full"
            aria-disabled={trimmed.length === 0 || tooLong}
            onClick={() => {
              if (trimmed.length > 0 && !tooLong) setStep('theme');
            }}
          >
            {th.common.next}
          </Button>
        </section>
      )}

      {shown === 'theme' && (
        <section className="flex flex-1 flex-col gap-4 motion-safe:animate-rise">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{th.welcome.themeTitle}</h1>
            <p className="text-muted">{th.welcome.themeHelp}</p>
          </div>
          <ThemePicker value={theme} onPick={setTheme} />
          <div className="mt-auto flex gap-2">
            {!asGuest && (
              <Button variant="secondary" onClick={() => setStep('name')}>
                {th.common.back}
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={() => {
                if (asGuest) {
                  learner.startGuest(theme);
                  router.replace('/learn');
                } else setStep('consent');
              }}
            >
              {asGuest ? th.welcome.start : th.common.next}
            </Button>
          </div>
        </section>
      )}

      {shown === 'consent' && (
        <section className="flex flex-1 flex-col gap-4 motion-safe:animate-rise">
          <h1 className="text-center text-2xl font-bold">{th.welcome.consentTitle}</h1>
          <p>{th.welcome.consentIntro}</p>
          <ul className="flex flex-col gap-2">
            {th.welcome.consentItems.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <CheckIcon className="mt-1 size-4 shrink-0 text-brand" />
                {item}
              </li>
            ))}
          </ul>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-surface px-4 py-2 font-medium">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="size-5 accent-[var(--brand)]"
            />
            {th.welcome.consentAgree}
          </label>
          {failed && (
            <p role="alert" className="text-center text-sm text-warn">
              {th.welcome.failed}
            </p>
          )}
          <div className="mt-auto flex gap-2">
            <Button variant="secondary" onClick={() => setStep('theme')}>
              {th.common.back}
            </Button>
            <Button
              className="flex-1"
              aria-disabled={!agreed || saving}
              aria-busy={saving}
              onClick={() => {
                if (agreed && !saving) void finish();
              }}
            >
              {th.welcome.start}
            </Button>
          </div>
        </section>
      )}

      {shown === 'pretest' && (
        <section className="flex flex-1 flex-col gap-4 motion-safe:animate-rise">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{th.welcome.pretestTitle}</h1>
            <p className="text-muted">{th.welcome.pretestBody}</p>
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <LinkButton href="/test/pre" className="w-full">
              {th.welcome.pretestYes}
            </LinkButton>
            <LinkButton href="/learn" variant="secondary" className="w-full">
              {th.welcome.pretestNo}
            </LinkButton>
          </div>
        </section>
      )}
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LoadingScreen } from '@/components/learn/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { signOut } from '@/lib/client/auth';
import { deviceSettings, type ColorScheme } from '@/lib/client/settings';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { ThemeId } from '@/lib/learner/types';
import { MAX_DISPLAY_NAME, type Account } from '@/lib/sync/types';
import { AvatarPicker } from './Avatar';
import { GoogleButton } from './SignInButtons';
import { learner, useLearner, useRequiredProfile } from './useLearner';
import { ThemePicker } from './WelcomeFlow';

const SCHEMES: ColorScheme[] = ['system', 'light', 'dark'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-5">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange(next: boolean): void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {help && <span className="block text-sm text-muted">{help}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-edge'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-surface transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  );
}

function AccountSection({ account }: { account: Account }) {
  const [name, setName] = useState(account.displayName);
  const [saved, setSaved] = useState(false);
  const nameId = useId();
  const trimmed = name.trim();
  const changed = trimmed !== account.displayName;
  const valid = trimmed.length > 0 && trimmed.length <= MAX_DISPLAY_NAME;

  return (
    <Section title={th.settings.account}>
      <div className="flex flex-col gap-1">
        <label htmlFor={nameId} className="font-medium">
          {th.settings.displayName}
        </label>
        <div className="flex gap-2">
          <input
            id={nameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            autoComplete="off"
            maxLength={MAX_DISPLAY_NAME + 5}
            aria-invalid={!valid}
            className="h-12 min-w-0 flex-1 rounded-xl border-2 border-edge bg-surface px-3 text-base outline-none focus:border-brand"
          />
          <Button
            variant="secondary"
            aria-disabled={!changed || !valid}
            onClick={async () => {
              if (changed && valid) {
                setSaved(await learner.updateAccount({ displayName: trimmed }));
              }
            }}
          >
            {th.common.save}
          </Button>
        </div>
        <p role="status" className="min-h-6 text-sm text-good">
          {saved ? th.common.saved : ''}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-sans font-medium">{th.settings.avatar}</h3>
        <AvatarPicker
          value={account.avatar}
          label={th.settings.avatar}
          onPick={(avatar) => void learner.updateAccount({ avatar })}
        />
      </div>
      <Toggle
        label={th.settings.showOnBoard}
        checked={account.showOnLeaderboard}
        onChange={(showOnLeaderboard) => void learner.updateAccount({ showOnLeaderboard })}
      />
    </Section>
  );
}

function DeleteAccount() {
  const [typed, setTyped] = useState('');
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  const inputId = useId();
  const confirmed = typed.trim() === th.settings.deleteWord;

  return (
    <Section title={th.settings.dangerZone}>
      <p className="text-sm">{th.settings.deleteBody}</p>
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium">
          {fillTokens(th.settings.deleteType, { word: th.settings.deleteWord })}
        </label>
        <input
          id={inputId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          className="h-12 rounded-xl border-2 border-edge bg-surface px-3 text-base outline-none focus:border-brand"
        />
      </div>
      <Button
        variant="secondary"
        className="w-full text-warn"
        aria-disabled={!confirmed}
        onClick={async () => {
          if (!confirmed) return;
          const deleted = await learner.deleteAccount();
          setFailed(!deleted);
          if (!deleted) return;
          await signOut().catch(() => {});
          learner.forgetDevice();
          router.replace('/');
        }}
      >
        {th.settings.deleteAction}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-warn">
          {th.settings.deleteFailed}
        </p>
      )}
    </Section>
  );
}

export function SettingsScreen() {
  const profile = useRequiredProfile();
  const { mode, account, configured } = useLearner();
  const settings = useSyncExternalStore(
    deviceSettings.subscribe,
    deviceSettings.get,
    deviceSettings.getServer,
  );
  const router = useRouter();
  if (!profile) return <LoadingScreen />;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-6">
      <h1 className="text-3xl font-semibold">
        <span className="marker">{th.settings.title}</span>
      </h1>

      {mode === 'account' && account && <AccountSection account={account} />}

      {mode === 'guest' && configured && (
        <Section title={th.settings.account}>
          <p className="text-sm text-muted">{th.settings.guestNote}</p>
          <GoogleButton label={th.settings.signIn} />
        </Section>
      )}

      <Section title={th.settings.learning}>
        <div className="flex flex-col gap-2">
          <h3 className="font-sans font-medium">{th.settings.theme}</h3>
          <ThemePicker
            value={profile.student.theme ?? 'shop'}
            onPick={(theme: ThemeId) => learner.dispatch({ type: 'set_theme', theme })}
          />
        </div>
        <Toggle
          label={th.settings.sound}
          checked={settings.sound}
          onChange={(sound) => deviceSettings.set({ sound })}
        />
      </Section>

      <Section title={th.settings.display}>
        <div className="flex flex-col gap-2">
          <h3 className="font-sans font-medium">{th.settings.colorScheme}</h3>
          <div
            role="radiogroup"
            aria-label={th.settings.colorScheme}
            className="grid grid-cols-3 gap-2"
          >
            {SCHEMES.map((scheme) => (
              <Button
                key={scheme}
                role="radio"
                aria-checked={settings.scheme === scheme}
                variant={settings.scheme === scheme ? 'selected' : 'secondary'}
                size="compact"
                className="text-sm"
                onClick={() => deviceSettings.set({ scheme })}
              >
                {th.settings.schemes[scheme]}
              </Button>
            ))}
          </div>
        </div>
        <Toggle
          label={th.settings.reduceMotion}
          checked={settings.reduceMotion}
          onChange={(reduceMotion) => deviceSettings.set({ reduceMotion })}
        />
      </Section>

      <Section title={th.settings.about}>
        <Link
          href="/privacy"
          className="flex min-h-11 items-center font-medium text-brand underline"
        >
          {th.settings.privacy}
        </Link>
        {mode === 'account' && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              await signOut().catch(() => {});
              learner.forgetDevice();
              router.replace('/');
            }}
          >
            {th.settings.signOut}
          </Button>
        )}
        {mode === 'guest' && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              if (window.confirm(th.settings.resetGuestConfirm)) {
                learner.forgetDevice();
                router.replace('/');
              }
            }}
          >
            {th.settings.resetGuest}
          </Button>
        )}
      </Section>

      {mode === 'account' && <DeleteAccount />}
    </main>
  );
}

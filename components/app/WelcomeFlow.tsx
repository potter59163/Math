'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useId, useState, type ComponentType } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import {
  BagIcon,
  BallIcon,
  BowlIcon,
  CheckIcon,
  GamepadIcon,
  MusicIcon,
} from '@/components/ui/Icons';
import { KeepWords } from '@/components/ui/KeepWords';
import { sendPhoto, shrinkPhoto } from '@/lib/client/photo';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { ThemeId } from '@/lib/learner/types';
import { MAX_DISPLAY_NAME, THEMES, type AvatarId } from '@/lib/sync/types';
import { activeTopicOf, enabledTopics, packOf } from '@/lib/topics';
import type { TopicId } from '@/lib/topics/types';
import { Avatar, AvatarPicker } from './Avatar';
import { savedCohort } from './Landing';
import { Mascot } from './Mascot';
import { learner, useLearner } from './useLearner';

type Step = 'name' | 'theme' | 'topic';

const THEME_ICON: Record<ThemeId, ComponentType<{ className?: string }>> = {
  shop: BagIcon,
  game: GamepadIcon,
  sport: BallIcon,
  music: MusicIcon,
  food: BowlIcon,
};

export function ThemePicker({ value, onPick }: { value: ThemeId; onPick(theme: ThemeId): void }) {
  return (
    <div role="radiogroup" aria-label={th.settings.theme} className="flex flex-col gap-2">
      {THEMES.map((theme) => {
        const Icon = THEME_ICON[theme];
        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => onPick(theme)}
            className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              theme === value ? 'border-ink bg-marker-soft' : 'border-edge bg-surface'
            }`}
          >
            <Icon className="size-6 shrink-0" />
            <span className="flex flex-1 flex-col">
              <span className="font-medium">{th.themes[theme].name}</span>
              {/* What the clips count in this theme, so the choice means something before it is made. */}
              <span className="text-sm text-muted">
                {th.scenes.intro.stories[theme].labels.cols.join(' ')}
              </span>
            </span>
            {theme === value && <CheckIcon className="size-5 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

/** The numbers of the sample table, the same in every theme: only the names change. */
const SAMPLE: readonly (readonly number[])[] = [
  [12, 8, 5],
  [9, 14, 6],
];

/**
 * A theme as the clips tell it: the table that the first unit's opening clip draws, with this theme's own
 * names, at the board where clips are taught.
 */
export function ThemeExample({ theme }: { theme: ThemeId }) {
  const { labels, u1 } = th.scenes.intro.stories[theme];
  return (
    <figure className="board flex flex-col gap-2 rounded-xl px-4 py-3">
      <p className="text-xs text-muted">{th.welcome.themeExample}</p>
      <table className="w-full table-fixed text-center font-hand tabular-nums">
        <thead>
          <tr>
            <td className="w-1/4" />
            {labels.cols.map((col) => (
              <th key={col} scope="col" className="pb-1 text-sm font-normal text-muted">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.rows.map((row, index) => (
            <tr key={row}>
              <th scope="row" className="text-left text-sm font-normal text-muted">
                {row}
              </th>
              {(SAMPLE[index] ?? []).map((value, column) => (
                <td key={column} className="text-xl text-ink">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="text-sm">
        <KeepWords text={u1.blocks} />
      </figcaption>
    </figure>
  );
}

/** Which topic to begin with, each with its units, so the choice is made knowing what is in it. */
function TopicPicker({
  topics,
  value,
  onPick,
}: {
  topics: readonly TopicId[];
  value: TopicId;
  onPick(topic: TopicId): void;
}) {
  return (
    <div role="radiogroup" aria-label={th.welcome.topicTitle} className="flex flex-col gap-3">
      {topics.map((topic) => {
        const { titleTh, noteTh, units } = packOf(topic);
        const selected = topic === value;
        return (
          <button
            key={topic}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(topic)}
            className={`flex flex-col gap-1 rounded-xl border-2 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              selected ? 'border-ink bg-marker-soft' : 'border-edge bg-surface'
            }`}
          >
            <span className="flex items-baseline gap-2">
              <span className="text-xl font-semibold">{titleTh}</span>
              <span className="text-sm text-muted">{noteTh}</span>
              {selected && <CheckIcon className="ml-auto size-5 shrink-0 self-center" />}
            </span>
            {/* Each unit's title stays whole: a title broken across lines reads as two units. */}
            <span className="text-sm text-muted">
              {units.map((unit, index) => (
                <Fragment key={unit.id}>
                  {index > 0 && ' · '}
                  <span className="whitespace-nowrap">{unit.titleTh}</span>
                </Fragment>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A picture made small on this device and not sent anywhere yet, with an address to show it by. */
interface PickedPhoto {
  blob: Blob;
  url: string;
}

/**
 * The student's own photo, offered beside the symbol. It stays on this device until the welcome is
 * finished: nothing is stored before the consent line has been seen (SPEC §15).
 */
function OwnPhoto({
  picked,
  avatar,
  onChange,
}: {
  picked: PickedPhoto | null;
  avatar: AvatarId;
  onChange(picked: PickedPhoto | null): void;
}) {
  const [failed, setFailed] = useState(false);
  const inputId = useId();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await shrinkPhoto(file);
      setFailed(false);
      onChange({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-sans font-medium">{th.welcome.photoTitle}</h2>
      <div className="flex items-center gap-4">
        {picked ? (
          // The picture exists only on this device so far, so a plain img shows it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picked.url}
            alt={th.settings.photo.alt}
            className="inline-block size-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <Avatar avatar={avatar} className="size-16 text-2xl" />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputId}
            className={buttonClass({ variant: 'secondary', size: 'compact' }, 'cursor-pointer')}
          >
            {picked ? th.settings.photo.change : th.settings.photo.upload}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          {picked && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="min-h-11 px-2 text-sm font-medium text-warn underline"
            >
              {th.settings.photo.remove}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted">{th.settings.photo.note}</p>
      {failed && (
        <p role="alert" className="text-sm text-warn">
          {th.welcome.photoFailed}
        </p>
      )}
    </div>
  );
}

function Steps({ at, total }: { at: number; total: number }) {
  return (
    <div
      role="img"
      aria-label={fillTokens(th.welcome.step, { n: String(at), total: String(total) })}
      className="flex gap-1.5"
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 flex-1 rounded-full ${index < at ? 'bg-ink' : 'bg-line'}`}
        />
      ))}
    </div>
  );
}

/**
 * The first visit. An account gives a name and a symbol, a guest neither; both pick how the clips tell
 * their stories and, when more than one topic is on, where to begin. The lessons page then offers that
 * topic's pre-test. Consent is the line above the last button, and the privacy page is one tap away.
 */
export function WelcomeFlow() {
  const { phase, mode } = useLearner();
  const router = useRouter();
  const guest = useSearchParams().has('guest');
  const topics = enabledTopics();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('bracket');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [theme, setTheme] = useState<ThemeId>('shop');
  const [topic, setTopic] = useState<TopicId>(topics[0]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const nameId = useId();
  const noteId = `${nameId}-note`;

  const asGuest = guest && phase !== 'needs_welcome';
  const steps: Step[] = [
    ...(asGuest ? [] : (['name'] as const)),
    'theme',
    ...(topics.length > 1 ? (['topic'] as const) : []),
  ];
  const shown = steps.includes(step) ? step : steps[0];
  const at = steps.indexOf(shown);
  const last = at === steps.length - 1;
  const trimmed = name.trim();
  const tooLong = trimmed.length > MAX_DISPLAY_NAME;

  // Whoever has nothing to do here moves on.
  useEffect(() => {
    if (saving) return;
    if (phase === 'signed_out' && !guest) router.replace('/');
    if (phase === 'ready' && mode === 'account') router.replace('/learn');
  }, [phase, mode, guest, saving, router]);

  // A picture's address holds it in memory until it is let go: when another replaces it, and on the way out.
  const photoUrl = photo?.url;
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  /** The lessons page opens on the topic chosen here, with that topic's pre-test on offer. */
  const enterTopic = () => {
    const student = learner.getState().profile?.student;
    if (student && activeTopicOf(student) !== topic) learner.dispatch({ type: 'set_topic', topic });
  };

  const finish = async () => {
    if (asGuest) {
      learner.startGuest(theme);
      enterTopic();
      router.replace('/learn');
      return;
    }
    setSaving(true);
    setFailed(false);
    const cohort = savedCohort();
    const done = await learner.finishWelcome({
      displayName: trimmed,
      avatar,
      theme,
      ...(cohort && { cohort }),
    });
    if (done) {
      // The account exists from here on, so the picture chosen on the way may be stored. One that will
      // not go up leaves the symbol in its place, for Settings to try again: it keeps nobody from the lessons.
      if (photo) {
        await sendPhoto(photo.blob).then(
          (photoAt) => learner.photoChanged(photoAt),
          () => {},
        );
      }
      enterTopic();
      router.replace('/learn');
    }
    setSaving(false);
    if (!done) setFailed(true);
  };

  const footer = (canGoOn: boolean) => (
    <div className="mt-auto flex flex-col gap-3">
      {last && !asGuest && (
        <p className="text-sm text-muted">
          <KeepWords text={th.welcome.consentLine} />{' '}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener"
            className="font-medium text-brand underline"
          >
            {th.welcome.privacyLink}
          </Link>
        </p>
      )}
      {last && failed && (
        <p role="alert" className="text-sm text-warn">
          {th.welcome.failed}
        </p>
      )}
      <div className="flex gap-2">
        {at > 0 && (
          <Button variant="secondary" onClick={() => setStep(steps[at - 1])}>
            {th.common.back}
          </Button>
        )}
        <Button
          className="flex-1"
          aria-disabled={!canGoOn || saving}
          aria-busy={saving}
          onClick={() => {
            if (!canGoOn || saving) return;
            if (last) void finish();
            else setStep(steps[at + 1]);
          }}
        >
          {last ? th.welcome.start : th.common.next}
        </Button>
      </div>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-6">
      {steps.length > 1 && <Steps at={at + 1} total={steps.length} />}

      {shown === 'name' && (
        <section className="flex flex-1 flex-col gap-5 motion-safe:animate-rise">
          <div className="flex items-center gap-3">
            <Mascot className="size-14 shrink-0 -rotate-3" />
            <h1 className="text-2xl leading-snug font-semibold">{th.welcome.nameTitle}</h1>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={nameId} className="sr-only">
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
              className="h-14 rounded-xl border-2 border-edge bg-surface px-4 font-hand text-lg text-brand outline-none focus:border-brand"
            />
            <p id={noteId} className={`text-sm ${tooLong ? 'text-warn' : 'text-muted'}`}>
              {tooLong
                ? fillTokens(th.welcome.nameTooLong, { max: String(MAX_DISPLAY_NAME) })
                : th.welcome.nameHelp}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-sans font-medium">{th.welcome.avatarTitle}</h2>
            <AvatarPicker value={avatar} label={th.welcome.avatarTitle} onPick={setAvatar} />
          </div>
          <OwnPhoto picked={photo} avatar={avatar} onChange={setPhoto} />
          {footer(trimmed.length > 0 && !tooLong)}
        </section>
      )}

      {shown === 'theme' && (
        <section className="flex flex-1 flex-col gap-5 motion-safe:animate-rise">
          <div className="flex items-center gap-3">
            <Mascot className="size-14 shrink-0 -rotate-3" />
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl leading-snug font-semibold">{th.welcome.themeTitle}</h1>
              <p className="text-sm text-muted">{th.welcome.themeHelp}</p>
            </div>
          </div>
          <ThemePicker value={theme} onPick={setTheme} />
          <ThemeExample theme={theme} />
          {footer(true)}
        </section>
      )}

      {shown === 'topic' && (
        <section className="flex flex-1 flex-col gap-5 motion-safe:animate-rise">
          <div className="flex items-center gap-3">
            <Mascot className="size-14 shrink-0 -rotate-3" mood="cheer" />
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl leading-snug font-semibold">{th.welcome.topicTitle}</h1>
              <p className="text-sm text-muted">
                <KeepWords text={th.welcome.topicHelp} />
              </p>
            </div>
          </div>
          <TopicPicker topics={topics} value={topic} onPick={setTopic} />
          {footer(true)}
        </section>
      )}
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';
import { LoadingScreen } from '@/components/learn/LoadingScreen';
import { Button, LinkButton } from '@/components/ui/Button';
import {
  BoltIcon,
  CheckIcon,
  FlameIcon,
  LockIcon,
  PlayIcon,
  StarIcon,
} from '@/components/ui/Icons';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { PathStep, Profile } from '@/lib/director/types';
import { itemsOn, streakOf } from '@/lib/learner/activity';
import { skillStateOf } from '@/lib/learner/profile';
import { mapOf, nextSkill, type SkillStatus, type UnitOnMap } from '@/lib/learner/progress';
import { recommendationFor, type Recommendation } from '@/lib/learner/recommend';
import { skillById, type SkillId } from '@/lib/topics/matrix/skills';
import { Mascot } from './Mascot';
import { learner, useLearner, useRequiredProfile } from './useLearner';

function recommendationText(recommendation: Recommendation): string {
  const copy = th.learn.recommend;
  switch (recommendation.kind) {
    case 'done':
      return copy.done;
    case 'fix':
      return fillTokens(copy.fix, { m: th.misconceptionShort[recommendation.misconception] });
    default:
      return fillTokens(copy[recommendation.kind], {
        skill: skillById(recommendation.skill).nameTh,
      });
  }
}

function Chips({ profile, now }: { profile: Profile; now: number }) {
  const streak = streakOf(profile.activity, now);
  return (
    <div className="flex shrink-0 items-center gap-2 font-matrix text-sm font-medium tabular-nums">
      <span
        role="img"
        aria-label={fillTokens(th.learn.streak, { n: String(streak) })}
        className={`inline-flex items-center gap-1 ${streak > 0 ? 'text-flame' : 'text-muted'}`}
      >
        <FlameIcon className="size-5" />
        {streak}
      </span>
      <span
        role="img"
        aria-label={fillTokens(th.common.xpLabel, { xp: String(profile.xp) })}
        className="inline-flex items-center gap-1 text-xp"
      >
        <BoltIcon className="size-5" />
        {profile.xp}
      </span>
    </div>
  );
}

function DailyGoal({ done }: { done: number }) {
  const goal = CONFIG.dailyGoalItems;
  const shown = Math.min(done, goal);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0 font-medium">{th.learn.dailyGoal}</span>
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={shown}
        aria-label={th.learn.dailyGoal}
        className="h-3 min-w-0 flex-1 overflow-hidden rounded-full border border-edge bg-surface"
      >
        <span
          className="block h-full origin-left bg-cta transition-transform"
          style={{ transform: `scaleX(${shown / goal})` }}
        />
      </span>
      <span className="shrink-0 font-matrix text-muted tabular-nums">
        {done >= goal
          ? th.learn.dailyDone
          : fillTokens(th.learn.dailyCount, { n: String(done), goal: String(goal) })}
      </span>
    </div>
  );
}

function ForYou({ profile, now }: { profile: Profile; now: number }) {
  const recommendation = recommendationFor(profile);
  const label =
    recommendation.kind === 'done'
      ? th.learn.keepPracticing
      : profile.itemsDone === 0
        ? th.learn.start
        : th.learn.continue;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Mascot
          className="size-14 shrink-0 -rotate-3"
          mood={recommendation.kind === 'done' ? 'cheer' : 'happy'}
        />
        <p className="font-hand text-lg leading-snug">{recommendationText(recommendation)}</p>
      </div>
      <LinkButton href="/learn/session" className="w-full">
        <PlayIcon className="size-4" />
        {label}
      </LinkButton>
      <DailyGoal done={itemsOn(profile.activity, now)} />
    </section>
  );
}

const NODE_LOOK: Record<SkillStatus, string> = {
  passed: 'bg-good text-on-brand shadow-[0_4px_0_var(--good-edge)]',
  current: 'border-[3px] border-cta-line bg-cta text-on-cta shadow-[0_4px_0_var(--cta-line)]',
  open: 'border-[3px] border-brand bg-surface text-brand shadow-[0_4px_0_var(--brand)]',
  locked: 'border-2 border-dashed border-edge bg-canvas text-muted',
};

const NODE_ICON = {
  passed: CheckIcon,
  current: PlayIcon,
  open: StarIcon,
  locked: LockIcon,
} as const;

/** The winding path of the map, in px from the middle. It stays inside 328px of width at 360px. */
const WIND = [0, 42, 62, 42, 0, -42, -62, -42];
const windAt = (index: number) => WIND[index % WIND.length];

/** Px from one skill's row to the next: the node, a label of up to two lines, and some air. */
const PITCH = 116;
const NODE_MIDDLE = 32;

/** The curve a pen would draw from one point to the next on this graph paper. */
function curveTo(index: number): string {
  const [x0, x1] = [windAt(index - 1), windAt(index)];
  const y0 = (index - 1) * PITCH + NODE_MIDDLE;
  const y1 = index * PITCH + NODE_MIDDLE;
  const bend = PITCH / 2;
  return `M${x0} ${y0}C${x0} ${y0 + bend} ${x1} ${y1 - bend} ${x1} ${y1}`;
}

function curveLook(status: SkillStatus): string {
  if (status === 'locked') return 'stroke-edge [stroke-dasharray:1_9]';
  return status === 'passed' ? 'stroke-good' : 'stroke-ink';
}

function SkillNode({
  id,
  status,
  index,
  onOpen,
}: {
  id: SkillId;
  status: SkillStatus;
  index: number;
  onOpen(id: SkillId): void;
}) {
  const Icon = NODE_ICON[status];
  const { nameTh } = skillById(id);
  return (
    <li className="relative flex justify-center" style={{ height: PITCH }}>
      <button
        type="button"
        onClick={() => onOpen(id)}
        // The button moves, not the row, which would widen the page past the screen.
        style={{ transform: `translateX(${windAt(index)}px)` }}
        className="group flex h-fit w-32 touch-manipulation flex-col items-center gap-1.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="relative">
          {status === 'current' && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-cta motion-safe:animate-pulse-ring"
            />
          )}
          <span
            className={`relative flex size-16 items-center justify-center rounded-full transition-transform duration-75 group-active:translate-y-[3px] ${NODE_LOOK[status]}`}
          >
            <Icon className="size-7" />
          </span>
        </span>
        <span
          className={`rounded bg-canvas px-1 text-center text-sm leading-snug font-medium ${status === 'locked' ? 'text-muted' : ''}`}
        >
          {nameTh}
          <span className="sr-only"> ({th.learn.status[status]})</span>
        </span>
      </button>
    </li>
  );
}

function UnitPath({ unit, skills, onOpen }: UnitOnMap & { onOpen(id: SkillId): void }) {
  const done = skills.filter(({ status }) => status === 'passed').length;
  return (
    <section className="flex flex-col gap-5">
      <h2 className="flex items-baseline gap-2">
        <span className="font-sans text-sm text-muted">
          {fillTokens(th.learn.unit, { n: String(unit) })}
        </span>
        <span className="marker text-xl">{th.units[unit]}</span>
        <span className="ml-auto font-matrix text-sm text-muted tabular-nums">
          {done}/{skills.length}
        </span>
      </h2>
      <ol className="relative flex flex-col">
        <li aria-hidden className="absolute top-0 left-1/2">
          <svg width="1" height="1" className="overflow-visible">
            {skills.slice(1).map(({ id, status }, index) => (
              <path
                key={id}
                d={curveTo(index + 1)}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                className={curveLook(status)}
              />
            ))}
          </svg>
        </li>
        {skills.map(({ id, status }, index) => (
          <SkillNode key={id} id={id} status={status} index={index} onOpen={onOpen} />
        ))}
      </ol>
    </section>
  );
}

/** Slides up from the bottom. A dialog keeps focus inside, and Escape or the button closes it. */
function SkillSheet({
  profile,
  id,
  status,
  onClose,
}: {
  profile: Profile;
  id: SkillId;
  status: SkillStatus;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const { nameTh, prereq, unit } = skillById(id);
  const percent = Math.round(skillStateOf(profile, id).pKnown * 100);
  const openPrereqs = prereq.filter((other) => profile.skills[other]?.passed !== true);

  const go = () => {
    // The skill the director is already on just carries on, with whatever is open.
    if (nextSkill(profile) !== id) learner.dispatch({ type: 'practice', skill: id });
    router.push('/learn/session');
  };

  return (
    <dialog
      ref={dialog}
      aria-label={nameTh}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-black/40 md:inset-auto md:top-1/2 md:left-1/2 md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
    >
      <div className="flex flex-col gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] motion-safe:animate-rise">
        <p className="text-sm text-muted">
          {fillTokens(th.learn.unit, { n: String(unit) })} · {th.units[unit]}
        </p>
        <h2 className="text-2xl">{nameTh}</h2>
        {status !== 'locked' && (
          <div className="flex items-center gap-2 text-sm">
            <span
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={fillTokens(th.learn.mastery, { p: String(percent) })}
              className="h-3 min-w-0 flex-1 overflow-hidden rounded-full border border-edge bg-surface"
            >
              <span
                className="block h-full origin-left bg-brand"
                style={{ transform: `scaleX(${percent / 100})` }}
              />
            </span>
            <span className="shrink-0 text-muted">
              {fillTokens(th.learn.mastery, { p: String(percent) })}
            </span>
          </div>
        )}
        {status === 'locked' ? (
          <p className="text-muted">
            {fillTokens(th.learn.sheetLocked, {
              skills: openPrereqs.map((other) => skillById(other).nameTh).join(', '),
            })}
          </p>
        ) : (
          <Button className="w-full" onClick={go}>
            {status === 'passed'
              ? th.learn.sheetAgain
              : status === 'current'
                ? th.learn.sheetContinue
                : th.learn.sheetStart}
          </Button>
        )}
        <Button variant="secondary" className="w-full" onClick={onClose}>
          {th.common.close}
        </Button>
      </div>
    </dialog>
  );
}

/** The latest steps chosen for this student, newest first, each with its reason (SPEC §4). */
function MyPath({ steps }: { steps: readonly PathStep[] }) {
  const recent = steps.slice(-CONFIG.pathStepsOnMap).reverse();
  if (recent.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg">{th.learn.myPath}</h2>
      <ol className="flex flex-col gap-2 border-l-2 border-margin pl-3">
        {recent.map(({ note, skill }, index) => (
          <li key={steps.length - index} className={index === 0 ? '' : 'text-muted'}>
            <p className="font-hand text-sm leading-relaxed">{note}</p>
            <p className="text-xs text-muted">{skillById(skill).nameTh}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The home of the app: what คิว suggests, then the whole path. */
export function LessonsScreen() {
  const profile = useRequiredProfile();
  const { mode, offline } = useLearner();
  const [now] = useState(() => Date.now());
  const [openSkill, setOpenSkill] = useState<SkillId | null>(null);
  if (!profile) return <LoadingScreen />;

  const units = mapOf(profile);
  const openStatus = units
    .flatMap(({ skills }) => skills)
    .find(({ id }) => id === openSkill)?.status;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-canvas px-4 py-2">
        <h1 className="min-w-0 flex-1 truncate text-xl leading-tight">{th.learn.topic}</h1>
        <Chips profile={profile} now={now} />
      </header>

      <main className="flex flex-col gap-8 px-4 py-5">
        {offline && (
          <p role="status" className="rounded-xl bg-warn-soft px-4 py-2 text-sm text-warn">
            {th.learn.offline}
          </p>
        )}
        <ForYou profile={profile} now={now} />
        {units.map((unit) => (
          <UnitPath key={unit.unit} {...unit} onOpen={setOpenSkill} />
        ))}
        <MyPath steps={profile.path} />
        {mode === 'guest' && (
          <Link
            href="/settings"
            className="flex min-h-11 items-center text-sm font-medium text-brand underline"
          >
            {th.learn.guestAction}
          </Link>
        )}
      </main>

      {openSkill && openStatus && (
        <SkillSheet
          key={openSkill}
          profile={profile}
          id={openSkill}
          status={openStatus}
          onClose={() => setOpenSkill(null)}
        />
      )}
    </div>
  );
}

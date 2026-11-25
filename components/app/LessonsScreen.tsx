'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';
import { LoadingScreen } from '@/components/learn/LoadingScreen';
import { Button, LinkButton } from '@/components/ui/Button';
import {
  BoltIcon,
  CheckIcon,
  FastForwardIcon,
  FlameIcon,
  LockIcon,
  PlayIcon,
  StarIcon,
} from '@/components/ui/Icons';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { latestStepsIn } from '@/lib/director/pathStep';
import type { PathStep, Profile } from '@/lib/director/types';
import { itemsOn, streakOf } from '@/lib/learner/activity';
import { hasPretestMarks, isQuickCheck, pretestCheckOf } from '@/lib/learner/pretest';
import { skillStateOf } from '@/lib/learner/profile';
import {
  itemsDoneIn,
  mapOf,
  nextSkill,
  type SkillStatus,
  type UnitOnMap,
} from '@/lib/learner/progress';
import { recommendationFor } from '@/lib/learner/recommend';
import { ASSESSED_TOPIC } from '@/lib/sync/assessment';
import {
  activeTopicOf,
  enabledTopics,
  misconceptionShortOf,
  packOf,
  packOfSkill,
  skillOf,
  unitOf,
} from '@/lib/topics';
import type { MisconceptionId, SkillId, TopicId } from '@/lib/topics/types';
import { Filled, KeepWords } from '@/components/ui/KeepWords';
import { Mascot } from './Mascot';
import { recommendationCopy } from './recommendationText';
import { unitName } from './unitText';
import { learner, useLearner, useRequiredProfile } from './useLearner';

function Chips({ profile, now }: { profile: Profile; now: number }) {
  const streak = streakOf(profile.activity, now);
  return (
    <div className="flex shrink-0 items-center gap-3 font-matrix text-sm font-semibold tabular-nums">
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

/** คิว's suggestion and the one yellow button of the page. */
function ForYou({
  profile,
  now,
  topic,
  showReport,
}: {
  profile: Profile;
  now: number;
  topic: TopicId;
  /** The pre-test left marks on this topic, so its result is worth a link. */
  showReport: boolean;
}) {
  const recommendation = recommendationFor(profile);
  const label =
    recommendation.kind === 'done'
      ? th.learn.keepPracticing
      : itemsDoneIn(profile, topic) === 0
        ? th.learn.start
        : th.learn.continue;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Mascot
          className="size-14 shrink-0 -rotate-3"
          mood={recommendation.kind === 'done' ? 'cheer' : 'happy'}
        />
        <p className="font-hand text-lg leading-snug">
          <Filled {...recommendationCopy(recommendation)} />
        </p>
      </div>
      <LinkButton href="/learn/session" className="w-full">
        <PlayIcon className="size-4" />
        {label}
      </LinkButton>
      <DailyGoal done={itemsOn(profile.activity, now)} />
      {showReport && (
        <Link
          href="/test/pre"
          className="-my-2 flex min-h-11 items-center text-sm font-medium text-brand underline"
        >
          {th.learn.pretestLink}
        </Link>
      )}
    </section>
  );
}

/** How many of the latest steps the lessons page shows, above the map (SPEC §4 allows up to five). */
const PATH_SHOWN = Math.min(3, CONFIG.pathStepsOnMap);

/** The latest steps คิว chose in the topic on screen, newest first, each with its reason (SPEC §4). */
function MyPath({ steps, topic }: { steps: readonly PathStep[]; topic: TopicId }) {
  const recent = latestStepsIn(steps, topic, PATH_SHOWN);
  if (recent.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-sans text-sm font-semibold text-muted">{th.learn.myPath}</h2>
      <ol className="flex flex-col gap-2 border-l-2 border-margin pl-3">
        {recent.map(({ note, skill }, index) => (
          <li key={index} className={index === 0 ? '' : 'text-muted'}>
            <p className="font-hand text-sm leading-relaxed">{note}</p>
            <p className="text-xs text-muted">{skillOf(skill).nameTh}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** What the pre-test left on a skill that has not passed: a quick check, or a mistake to check first. */
type Mark = { kind: 'quick' } | { kind: 'check'; misconception: MisconceptionId } | null;

function markOf(profile: Profile, id: SkillId, status: SkillStatus): Mark {
  if (status === 'passed') return null;
  const waiting = pretestCheckOf(profile, id);
  if (waiting) return { kind: 'check', misconception: waiting };
  return isQuickCheck(profile, id) ? { kind: 'quick' } : null;
}

const NODE_LOOK: Record<SkillStatus | 'quick', string> = {
  passed: 'bg-good text-on-brand shadow-[0_4px_0_var(--good-edge)]',
  current: 'border-[3px] border-cta-line bg-cta text-on-cta shadow-[0_4px_0_var(--cta-line)]',
  open: 'border-[3px] border-brand bg-surface text-brand shadow-[0_4px_0_var(--brand)]',
  locked: 'border-2 border-dashed border-edge bg-canvas text-muted',
  // Known from the pre-test and waiting for its one right answer, wherever it is on the path.
  quick: 'border-[3px] border-good bg-surface text-good shadow-[0_4px_0_var(--good-edge)]',
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

/** Px from one skill's row to the next: the node, a label of up to two lines, a mark, and some air. */
const PITCH = 132;
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
  mark,
  index,
  onOpen,
}: {
  id: SkillId;
  status: SkillStatus;
  mark: Mark;
  index: number;
  onOpen(id: SkillId): void;
}) {
  const quick = mark?.kind === 'quick';
  const Icon = quick && status !== 'passed' ? FastForwardIcon : NODE_ICON[status];
  const look =
    quick && (status === 'open' || status === 'locked') ? NODE_LOOK.quick : NODE_LOOK[status];
  const { nameTh } = skillOf(id);
  return (
    <li className="relative flex justify-center" style={{ height: PITCH }}>
      <button
        type="button"
        onClick={() => onOpen(id)}
        // The button moves, not the row, which would widen the page past the screen.
        style={{ transform: `translateX(${windAt(index)}px)` }}
        className="group flex h-fit w-40 touch-manipulation flex-col items-center gap-1.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span
          className={`relative flex size-16 items-center justify-center rounded-full transition-transform duration-75 group-active:translate-y-[3px] ${look}`}
        >
          <Icon className="size-7" />
          {mark?.kind === 'check' && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-surface bg-warn font-matrix text-sm font-bold text-surface"
            >
              !
            </span>
          )}
        </span>
        <span
          className={`rounded bg-canvas px-1 text-center text-sm leading-snug font-medium ${status === 'locked' && !quick ? 'text-muted' : ''}`}
        >
          <KeepWords text={nameTh} />
          <span className="sr-only"> ({th.learn.status[status]})</span>
        </span>
        {mark && (
          <span
            className={`-mt-1 rounded bg-canvas px-1 text-xs font-semibold ${quick ? 'text-good' : 'text-warn'}`}
          >
            {quick ? th.learn.markQuick : th.learn.markCheck}
          </span>
        )}
      </button>
    </li>
  );
}

function UnitPath({
  unit,
  skills,
  profile,
  onOpen,
}: UnitOnMap & { profile: Profile; onOpen(id: SkillId): void }) {
  const done = skills.filter(({ status }) => status === 'passed').length;
  return (
    <section className="flex flex-col gap-5">
      <h2 className="flex items-baseline gap-2">
        <span className="shrink-0 font-sans text-sm text-muted">{unitName(unit)}</span>
        <span className="marker min-w-0 text-xl">{unitOf(unit).titleTh}</span>
        <span className="ml-auto shrink-0 font-matrix text-sm text-muted tabular-nums">
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
          <SkillNode
            key={id}
            id={id}
            status={status}
            mark={markOf(profile, id, status)}
            index={index}
            onOpen={onOpen}
          />
        ))}
      </ol>
    </section>
  );
}

/** What the sheet says about a skill: its estimate once begun, or what the pre-test found before that. */
function SheetStatus({
  profile,
  id,
  status,
}: {
  profile: Profile;
  id: SkillId;
  status: SkillStatus;
}) {
  const state = skillStateOf(profile, id);
  const begun = state.attempts.length > 0 || status === 'passed';
  if (!begun) {
    const waiting = pretestCheckOf(profile, id);
    if (waiting) {
      return (
        <p className="font-hand text-warn">
          {fillTokens(th.learn.sheetCheck, { m: misconceptionShortOf(waiting) })}
        </p>
      );
    }
    if (isQuickCheck(profile, id)) {
      return (
        <p className="flex items-center gap-2 font-medium text-good">
          <FastForwardIcon className="size-4 shrink-0" />
          {th.learn.sheetQuick}
        </p>
      );
    }
    return <p className="text-muted">{th.learn.sheetNotStarted}</p>;
  }
  const percent = Math.round(state.pKnown * 100);
  return (
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
          className={`block h-full origin-left ${status === 'passed' ? 'bg-good' : 'bg-brand'}`}
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      </span>
      <span className="shrink-0 text-muted">
        {fillTokens(th.learn.mastery, { p: String(percent) })}
      </span>
    </div>
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

  const { nameTh, prereq, unit } = skillOf(id);
  const begun = skillStateOf(profile, id).attempts.length > 0;
  const openPrereqs = prereq.filter((other) => profile.skills[other]?.passed !== true);

  const go = () => {
    // The skill the director is already on just carries on, with whatever is open.
    if (nextSkill(profile, packOfSkill(id).id) !== id) {
      learner.dispatch({ type: 'practice', skill: id });
    }
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
          {unitName(unit)} · {unitOf(unit).titleTh}
        </p>
        <h2 className="text-2xl">{nameTh}</h2>
        <SheetStatus profile={profile} id={id} status={status} />
        {status === 'locked' ? (
          <p className="text-muted">
            {fillTokens(th.learn.sheetLocked, {
              skills: openPrereqs.map((other) => skillOf(other).nameTh).join(', '),
            })}
          </p>
        ) : (
          <Button className="w-full" onClick={go}>
            {status === 'passed'
              ? th.learn.sheetAgain
              : begun
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

/**
 * "เมทริกซ์ | เวกเตอร์": only when more than one topic is switched on. Choosing one is an action, so
 * the director plans in it on this device and on the server alike.
 */
function TopicTabs({ topics, shown }: { topics: readonly TopicId[]; shown: TopicId }) {
  return (
    <div
      role="tablist"
      aria-label={th.learn.topicTabs}
      className="flex gap-1 rounded-xl bg-sunken p-1"
    >
      {topics.map((topic) => {
        const selected = topic === shown;
        return (
          <button
            key={topic}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              if (!selected) learner.dispatch({ type: 'set_topic', topic });
            }}
            className={`min-h-11 min-w-0 flex-1 touch-manipulation truncate rounded-lg px-3 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              selected ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(23_33_46/0.18)]' : 'text-muted'
            }`}
          >
            {packOf(topic).titleTh}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The home of the app: what คิว suggests and the latest steps it chose, then the whole path. On a wide
 * screen the suggestion stays beside the path instead of above it.
 */
export function LessonsScreen() {
  const profile = useRequiredProfile();
  const { mode, offline } = useLearner();
  const [now] = useState(() => Date.now());
  const [openSkill, setOpenSkill] = useState<SkillId | null>(null);
  if (!profile) return <LoadingScreen />;

  const topics = enabledTopics();
  const many = topics.length > 1;
  const shown = packOf(activeTopicOf(profile.student));
  const units = mapOf(profile, shown.id);
  const openStatus = units
    .flatMap(({ skills }) => skills)
    .find(({ id }) => id === openSkill)?.status;
  const showReport =
    mode === 'account' && shown.id === ASSESSED_TOPIC && hasPretestMarks(profile, shown.id);

  return (
    <div className="flex w-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-lg items-center gap-2 px-4 py-2 lg:max-w-5xl">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl leading-tight">
              {many ? th.learn.title : shown.titleTh}
            </h1>
            {!many && <p className="truncate text-xs text-muted">{shown.noteTh}</p>}
          </div>
          <Chips profile={profile} now={now} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-4 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-14 lg:py-8">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:order-2">
          {many && <TopicTabs topics={topics} shown={shown.id} />}
          {offline && (
            <p role="status" className="rounded-xl bg-warn-soft px-4 py-2 text-sm text-warn">
              {th.learn.offline}
            </p>
          )}
          <ForYou profile={profile} now={now} topic={shown.id} showReport={showReport} />
          <MyPath steps={profile.path} topic={shown.id} />
          {mode === 'guest' && (
            <Link
              href="/settings"
              className="flex min-h-11 items-center text-sm font-medium text-brand underline"
            >
              {th.learn.guestAction}
            </Link>
          )}
        </aside>

        <div className="mt-8 flex flex-col gap-8 lg:order-1 lg:mt-0">
          {units.map((unit) => (
            <UnitPath key={unit.unit} {...unit} profile={profile} onOpen={setOpenSkill} />
          ))}
        </div>
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

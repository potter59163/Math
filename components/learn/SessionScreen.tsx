'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { AnswerBox, type ClosedTone } from '@/components/input/AnswerBox';
import { ChoiceButtons } from '@/components/input/ChoiceButtons';
import { DimsInput } from '@/components/input/DimsInput';
import { Keypad } from '@/components/input/Keypad';
import { MatrixInput } from '@/components/input/MatrixInput';
import { Button, LinkButton } from '@/components/ui/Button';
import { BulbIcon, CheckIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import {
  emptyDraft,
  focusBox,
  moveActive,
  pickChoice,
  pressKey,
  readiness,
  toggleUndefined,
  type Direction,
  type Draft,
  type KeypadKey,
  type NotReadyReason,
} from '@/lib/practice/draft';
import { hintAt, type Hint } from '@/lib/practice/hints';
import { actionFromKey } from '@/lib/practice/keyboard';
import { nextSkill } from '@/lib/practice/path';
import {
  advanceHint,
  issueItem,
  rebuildItem,
  submitAttempt,
  type AttemptOutcome,
} from '@/lib/practice/profile';
import { profileStore } from '@/lib/practice/store';
import type { HintLevel, Profile } from '@/lib/practice/types';
import { skillById } from '@/lib/topics/matrix/skills';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { FeedbackCard } from './FeedbackCard';
import { HintBubble } from './HintBubble';
import { ItemPrompt } from './ItemPrompt';
import { preloadFormula } from './LazyFormula';
import { LoadingScreen } from './LoadingScreen';
import { StatBadges } from './StatBadges';
import { useRequiredProfile } from './useProfile';
import { WorkedSolutionSheet } from './WorkedSolutionSheet';

/**
 * The keypad, the choice buttons and the feedback card all live in this one fixed slot, which is how
 * sending an answer avoids any layout shift. 278px is 44px of actions, 210px of keypad, gaps and padding.
 */
const ANSWER_SLOT = 'mx-auto h-[278px] w-full max-w-lg px-4 py-2';

const DIRECTIONS: readonly string[] = ['left', 'right', 'up', 'down'];

interface ClosedItem {
  item: MatrixItem;
  outcome: AttemptOutcome;
  /** Kept as they were on sending, so the hint on screen does not change under the feedback. */
  hintLevel: HintLevel;
  caught: Profile['caught'];
}

export function SessionScreen() {
  const profile = useRequiredProfile();
  return profile ? <SessionLoop profile={profile} /> : <LoadingScreen />;
}

function SessionLoop({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [closed, setClosed] = useState<ClosedItem | null>(null);

  const ref = profile.current?.ref;
  const open = useMemo(() => (ref ? rebuildItem(ref) : null), [ref]);
  const finished = nextSkill(profile) === null;

  useEffect(() => {
    if (!closed && !open && !finished) profileStore.save(issueItem(profile));
  }, [closed, open, finished, profile]);

  const item = closed?.item ?? open;
  if (!item) return finished ? <AllDone /> : <LoadingScreen />;

  const submit = (answer: Answer) => {
    if (!open) return;
    const result = submitAttempt(profile, open, answer);
    setClosed({
      item: open,
      outcome: result.outcome,
      hintLevel: profile.current?.hintLevel ?? 0,
      caught: profile.caught,
    });
    profileStore.save(result.profile);
    if (result.outcome.classification.type !== 'correct') preloadFormula();
  };

  const goNext = () => {
    if (closed?.outcome.allPassed) {
      router.push('/summary');
      return;
    }
    setClosed(null);
    profileStore.save(issueItem(profile));
  };

  const askHint = () => {
    const next = advanceHint(profile);
    profileStore.save(next);
    // Hint L3 shows a formula, so have it ready by the time the student asks.
    if (next.current?.hintLevel === 2) preloadFormula();
  };

  return (
    <ItemScreen
      key={`${item.ref.seed}:${item.ref.skill}:${item.ref.difficulty}`}
      item={item}
      profile={profile}
      closed={closed}
      onSubmit={submit}
      onHint={askHint}
      onNext={goNext}
    />
  );
}

function AllDone() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <CheckIcon className="size-12 text-good" />
      <h1 className="text-xl font-bold">{th.session.allDone}</h1>
      <LinkButton href="/summary" className="w-full">
        {th.session.finish}
      </LinkButton>
    </main>
  );
}

interface ItemScreenProps {
  item: MatrixItem;
  profile: Profile;
  closed: ClosedItem | null;
  onSubmit(answer: Answer): void;
  onHint(): void;
  onNext(): void;
}

function ItemScreen({ item, profile, closed, onSubmit, onHint, onNext }: ItemScreenProps) {
  const [draft, setDraft] = useState(() => emptyDraft(item));
  const [issue, setIssue] = useState<NotReadyReason | null>(null);
  const [showWorked, setShowWorked] = useState(false);
  const scroller = useRef<HTMLElement>(null);
  const hintSpot = useRef<HTMLDivElement>(null);

  const isClosed = closed !== null;
  const isChoice = item.kind === 'choice';
  const hintLevel = closed?.hintLevel ?? profile.current?.hintLevel ?? 0;
  const hint =
    hintLevel > 0
      ? hintAt(item, hintLevel as Hint['level'], closed?.caught ?? profile.caught)
      : null;
  const state = readiness(item, draft);

  const edit = (change: (current: Draft) => Draft) => {
    setDraft(change);
    setIssue(null);
  };
  const press = (key: KeypadKey) => edit((current) => pressKey(current, item, key));
  const askHint = () => {
    setIssue(null);
    onHint();
  };

  const send = () => {
    if (state.ready) {
      onSubmit(state.answer);
      return;
    }
    setIssue(state.reason);
    const { box } = state;
    if (box !== null) setDraft((current) => focusBox(current, box));
  };

  const onBoardKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action = actionFromKey(event.code, event.key);
    if (action === null) return;
    // Enter on a focused button should press that button, not send the answer.
    const onButton =
      event.target instanceof HTMLElement && event.target.closest('button:not([data-box])');
    if (action === 'send' && onButton) return;
    event.preventDefault();
    if (action === 'send') send();
    else if (DIRECTIONS.includes(action)) {
      edit((current) => moveActive(current, item, action as Direction));
    } else press(action as KeypadKey);
  });

  useEffect(() => {
    if (isClosed) return;
    const listener = (event: KeyboardEvent) => onBoardKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [isClosed]);

  // On a short screen the answer grid can scroll away, so keep the box being typed in visible.
  useEffect(() => {
    scroller.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [draft.active]);

  useEffect(() => {
    if (hintLevel > 0) hintSpot.current?.scrollIntoView({ block: 'nearest' });
  }, [hintLevel]);

  const skill = skillById(item.ref.skill);
  const answered = closed ? answeredLine(item, draft) : '';

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-line bg-surface">
        <div className="mx-auto flex h-12 w-full max-w-lg items-center gap-1 pr-3 pl-1">
          <Link
            href="/summary"
            className="flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-muted"
          >
            {th.session.stop}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <p className="max-w-full truncate text-sm font-semibold">{skill.nameTh}</p>
            <LevelDots level={item.ref.difficulty} max={skill.maxLevel} />
          </div>
          <StatBadges xp={profile.xp} combo={profile.combo} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col short-landscape:flex-row">
        <main
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2"
        >
          <div className="mx-auto flex max-w-lg flex-col gap-3">
            <ItemPrompt item={item} />
            {!isChoice && (
              <div className="flex justify-center">
                <AnswerBoxes
                  item={item}
                  draft={draft}
                  outcome={closed?.outcome}
                  onSelect={(box) => edit((current) => focusBox(current, box))}
                />
              </div>
            )}
            {hint && (
              <div ref={hintSpot}>
                <HintBubble key={hint.level} hint={hint} />
              </div>
            )}
            {/* Last in the flow, so appearing on send cannot move anything above it. */}
            {answered && <p className="text-center text-sm text-muted">{answered}</p>}
          </div>
        </main>

        <div className="relative shrink-0 border-t border-line bg-sunken pb-[env(safe-area-inset-bottom)] short-landscape:w-[22rem] short-landscape:border-t-0 short-landscape:border-l">
          {/* Floats over the item: always in view on a short screen, and takes up no space. */}
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 -top-10 flex justify-center px-4"
          >
            {issue && (
              <span className="rounded-full bg-ink px-3 py-1 text-sm font-medium text-canvas shadow-md motion-safe:animate-rise">
                {issueText(issue, isChoice)}
              </span>
            )}
          </div>
          <div className={ANSWER_SLOT}>
            {closed ? (
              <FeedbackCard
                outcome={closed.outcome}
                onNext={onNext}
                onShowWorked={() => setShowWorked(true)}
              />
            ) : isChoice ? (
              <div className="flex h-full flex-col gap-2">
                <div className="flex">
                  <HintButton level={hintLevel} onHint={askHint} />
                </div>
                <ChoiceButtons
                  options={item.options ?? []}
                  selected={draft.choice}
                  onPick={(id) => edit((current) => pickChoice(current, id))}
                />
                <Button aria-disabled={!state.ready} onClick={send}>
                  <CheckIcon className="size-4" />
                  {th.session.send}
                </Button>
              </div>
            ) : (
              <div className="flex h-full flex-col gap-2">
                <div className="flex gap-2">
                  <HintButton level={hintLevel} onHint={askHint} />
                  {(item.kind === 'matrix_or_undefined' || item.kind === 'dims_or_undefined') && (
                    <Button
                      variant={draft.isUndefined ? 'selected' : 'secondary'}
                      size="md"
                      aria-pressed={draft.isUndefined}
                      className="flex-1 text-sm"
                      onClick={() => edit(toggleUndefined)}
                    >
                      {th.session.undefined}
                    </Button>
                  )}
                </div>
                <Keypad
                  digitsOnly={item.kind === 'dims' || item.kind === 'dims_or_undefined'}
                  sendReady={state.ready}
                  onKey={press}
                  onSend={send}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showWorked && <WorkedSolutionSheet item={item} onClose={() => setShowWorked(false)} />}
    </div>
  );
}

function LevelDots({ level, max }: { level: number; max: number }) {
  const label = fillTokens(th.session.level, { level: String(level), max: String(max) });
  return (
    <span role="img" aria-label={label} className="flex gap-1">
      {Array.from({ length: max }, (_, index) => (
        <span
          key={index}
          className={`size-1.5 rounded-full ${index < level ? 'bg-brand' : 'bg-line'}`}
        />
      ))}
    </span>
  );
}

function HintButton({ level, onHint }: { level: HintLevel; onHint(): void }) {
  const label =
    level === 0 ? th.session.hint : level < 3 ? th.session.hintMore : th.session.hintsUsedUp;
  return (
    <Button
      variant="secondary"
      size="md"
      disabled={level === 3}
      className="flex-1 text-sm"
      onClick={onHint}
    >
      <BulbIcon className="size-4 text-brand" />
      {label}
      {level > 0 && <span className="font-matrix text-muted tabular-nums">{level}/3</span>}
    </Button>
  );
}

interface AnswerBoxesProps {
  item: MatrixItem;
  draft: Draft;
  outcome?: AttemptOutcome;
  onSelect(box: number): void;
}

function AnswerBoxes({ item, draft, outcome, onSelect }: AnswerBoxesProps) {
  const classification = outcome?.classification;
  const closedTone: ClosedTone | undefined = classification
    ? classification.type === 'correct'
      ? 'correct'
      : 'neutral'
    : undefined;

  if (item.kind === 'matrix' || item.kind === 'matrix_or_undefined') {
    return (
      <MatrixInput
        grid={item.grid ?? { rows: 1, cols: 1 }}
        draft={draft}
        closedTone={closedTone}
        wrongCell={classification?.type === 'slip' ? classification.cell : undefined}
        onSelect={onSelect}
      />
    );
  }
  if (item.kind === 'dims' || item.kind === 'dims_or_undefined') {
    return <DimsInput draft={draft} closedTone={closedTone} onSelect={onSelect} />;
  }
  return (
    <AnswerBox
      text={draft.cells[0]}
      label={th.session.box.answer}
      active
      closedTone={closedTone}
      sizeClass="h-14 w-36"
      onSelect={() => onSelect(0)}
    />
  );
}

function issueText(issue: NotReadyReason, isChoice: boolean): string {
  return isChoice ? th.session.issues.noChoice : th.session.issues[issue];
}

/** Repeats an answer the closed screen no longer shows: a choice, or the undefined button. */
function answeredLine(item: MatrixItem, draft: Draft): string {
  const option = item.options?.find(({ id }) => id === draft.choice);
  const answer = draft.isUndefined ? th.session.undefined : option && th.choices[option.labelKey];
  return answer ? fillTokens(th.session.yourAnswer, { answer }) : '';
}

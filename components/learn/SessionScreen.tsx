'use client';

import Link from 'next/link';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { AnswerBox, type ClosedTone } from '@/components/input/AnswerBox';
import { ChoiceButtons } from '@/components/input/ChoiceButtons';
import { DimsInput } from '@/components/input/DimsInput';
import { Keypad } from '@/components/input/Keypad';
import { MatrixInput } from '@/components/input/MatrixInput';
import { Button } from '@/components/ui/Button';
import { BulbIcon, CheckIcon } from '@/components/ui/Icons';
import { learner, useLearner, useRequiredProfile } from '@/components/app/useLearner';
import { LazyScene, preloadScenes } from '@/components/scenes/LazyScene';
import type { SceneView } from '@/components/scenes/playerState';
import { th } from '@/lib/content/th';
import { restoreAnswer, storeAnswer } from '@/lib/core/answerJson';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { rebuildItem } from '@/lib/director/items';
import { stripNote } from '@/lib/director/pathStep';
import { sceneOfChosen, sceneOrNull, workedRequest } from '@/lib/director/scene';
import type {
  ChosenScene,
  ClosedAttempt,
  NextTurn,
  Profile,
  SceneRequest,
} from '@/lib/director/types';
import { openMisconceptions } from '@/lib/learner/profile';
import type { AttemptOutcome, HintLevel } from '@/lib/learner/types';
import {
  draftFromAnswer,
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
import type { SceneSpec } from '@/lib/topics/matrix/scenes';
import { skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { FeedbackCard } from './FeedbackCard';
import { HintBubble } from './HintBubble';
import { ItemPrompt } from './ItemPrompt';
import { preloadFormula } from './LazyFormula';
import { LoadingScreen } from './LoadingScreen';
import { PathStrip } from './PathStrip';
import { StatBadges } from './StatBadges';

/**
 * The keypad, the choice buttons and the feedback card all live in this one fixed slot, which is how
 * sending an answer avoids any layout shift. 278px is 44px of actions, 210px of keypad, gaps and padding.
 */
const ANSWER_SLOT = 'mx-auto h-[278px] w-full max-w-lg px-4 py-2';

const DIRECTIONS: readonly string[] = ['left', 'right', 'up', 'down'];

interface ClosedItem extends Omit<ClosedAttempt, 'ref' | 'answer'> {
  item: MatrixItem;
  answer: Answer;
  turn: NextTurn;
}

/** The skill a clip is about: the one it leads into, or else the item on screen. */
function skillOfScene(request: SceneRequest, fallback: SkillId): SkillId {
  return request.kind === 'intro' || request.kind === 'concept' ? request.skill : fallback;
}

function sceneTitle(spec: SceneSpec, skill: SkillId): string {
  const { nameTh, unit } = skillById(skill);
  if (spec.purpose === 'intro') {
    return fillTokens(th.scenes.player.unitTitle, { n: String(unit), name: th.units[unit] });
  }
  return spec.purpose === 'reveal' ? th.session.workedTitle : nameTh;
}

/** How long "ข้อถัดไป" waits for the tutor, a little over the server's own limit (AI_DIRECTOR §4.5). */
const TUTOR_WAIT_MS = 4500;

function logView(spec: SceneSpec, view: SceneView): void {
  learner.dispatch({
    type: 'scene_view',
    view: { template: spec.template, purpose: spec.purpose, ...view },
  });
}

export function SessionScreen() {
  const profile = useRequiredProfile();
  return profile ? <SessionLoop profile={profile} /> : <LoadingScreen />;
}

/** A clip with no feedback to go back to, like the lead clip of a new session. Never blocks the item. */
function ClipOnly({ profile, clip }: { profile: Profile; clip: ChosenScene }) {
  const { request } = clip;
  const spec = useMemo(() => sceneOfChosen(clip), [clip]);
  const skip = useEffectEvent(() => learner.dispatch({ type: 'finish_scene' }));
  useEffect(() => {
    if (!spec) skip();
  }, [spec]);

  return (
    <>
      <LoadingScreen />
      {spec && (
        <LazyScene
          modal
          spec={spec}
          title={sceneTitle(spec, skillOfScene(request, profile.current?.ref.skill ?? 'dim'))}
          onView={(view) => logView(spec, view)}
          onDone={() => learner.dispatch({ type: 'finish_scene' })}
        />
      )}
    </>
  );
}

function SessionLoop({ profile }: { profile: Profile }) {
  const { pending, current } = profile;
  const ref = current?.ref;
  const open = useMemo(() => (ref ? rebuildItem(ref) : null), [ref]);

  // Lives in the profile, so a reload after sending comes back to this same feedback and next step.
  const closed = useMemo((): ClosedItem | null => {
    if (!pending?.closed) return null;
    const { ref: closedRef, answer, ...rest } = pending.closed;
    const item = rebuildItem(closedRef);
    return item && { ...rest, item, answer: restoreAnswer(answer), turn: pending.turn };
  }, [pending]);

  const clip = !closed && pending ? pending.turn.scenes[0] : undefined;
  const lostTurn = pending && !closed && !clip;

  useEffect(() => {
    if (lostTurn) learner.dispatch({ type: 'finish_turn' });
    else if (!pending && !open) learner.dispatch({ type: 'start' });
  }, [lostTurn, pending, open]);

  useEffect(preloadScenes, []);

  if (clip) {
    return <ClipOnly key={JSON.stringify(clip.request)} profile={profile} clip={clip} />;
  }

  const item = closed?.item ?? open;
  if (!item) return <LoadingScreen />;

  const submit = (answer: Answer, time: { timeMs: number; at: number }) => {
    if (!open) return;
    const hintLevel = profile.current?.hintLevel ?? 0;
    const { outcome } = learner.dispatch({
      type: 'attempt',
      ref: open.ref,
      answer: storeAnswer(answer),
      hintLevel,
      ...time,
    });
    if (outcome?.classification.type !== 'correct') preloadFormula();
  };

  const askHint = () => {
    const { profile: next } = learner.dispatch({ type: 'hint' });
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
      onNext={() => learner.dispatch({ type: 'finish_turn' })}
      onSceneDone={() => learner.dispatch({ type: 'finish_scene' })}
    />
  );
}

interface ItemScreenProps {
  item: MatrixItem;
  profile: Profile;
  closed: ClosedItem | null;
  onSubmit(answer: Answer, time: { timeMs: number; at: number }): void;
  onHint(): void;
  /** Press on from the feedback with no clip to play. */
  onNext(): void;
  /** A clip of this turn has closed, watched or skipped. */
  onSceneDone(): void;
}

interface OpenScene {
  spec: SceneSpec;
  /** Whose clip it is, for its title. */
  skill: SkillId;
  /** What follows the clip, if anything besides going back to this screen. */
  then?: () => void;
  doneLabel?: string;
}

function ItemScreen({
  item,
  profile,
  closed,
  onSubmit,
  onHint,
  onNext,
  onSceneDone,
}: ItemScreenProps) {
  // After a reload a closed item has no typing to show, so its boxes are filled from the answer sent.
  const [draft, setDraft] = useState(() =>
    closed ? draftFromAnswer(item, closed.answer) : emptyDraft(item),
  );
  const [issue, setIssue] = useState<NotReadyReason | null>(null);
  // Lives over this screen, which stays mounted underneath: what was typed so far is still there after.
  const [scene, setScene] = useState<OpenScene | null>(null);
  const [waiting, setWaiting] = useState(false);
  const { llm, thinking } = useLearner();
  const helpPresses = useRef(0);
  const scroller = useRef<HTMLElement>(null);
  const hintSpot = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  const isClosed = closed !== null;
  const sceneIsOpen = scene !== null;
  const isChoice = item.kind === 'choice';
  const hintLevel = closed?.hintLevel ?? profile.current?.hintLevel ?? 0;
  const hint =
    hintLevel > 0
      ? hintAt(item, hintLevel as Hint['level'], closed?.openAtSend ?? openMisconceptions(profile))
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
  const askHelp = () => {
    const { turn } = learner.dispatch({ type: 'help', ref: item.ref, nth: helpPresses.current });
    helpPresses.current += 1;
    setIssue(null);
    if (!turn) return;
    const spec = sceneOrNull(turn.scenes[0].request);
    if (spec) setScene({ spec, skill: item.ref.skill });
  };

  const send = () => {
    if (state.ready) {
      const at = Date.now();
      onSubmit(state.answer, { at, timeMs: at - openedAt.current });
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
    if (isClosed || sceneIsOpen) return;
    const listener = (event: KeyboardEvent) => onBoardKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [isClosed, sceneIsOpen]);

  // On a short screen the answer grid can scroll away, so keep the box being typed in visible.
  useEffect(() => {
    scroller.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [draft.active]);

  useEffect(() => {
    if (hintLevel > 0) hintSpot.current?.scrollIntoView({ block: 'nearest' });
  }, [hintLevel]);

  const skill = skillById(item.ref.skill);
  const answered = closed ? answeredLine(item, draft) : '';

  /**
   * R1 and friends: what the director chose plays now, and the next item comes after it. With the tutor
   * on, its decision may still be on the way, so wait a moment and then read whichever is newest.
   */
  const goOn = async () => {
    if (llm && thinking) {
      setWaiting(true);
      await learner.settled(TUTOR_WAIT_MS);
      setWaiting(false);
    }
    const turn = learner.getState().profile?.pending?.turn ?? closed?.turn;
    const next = turn?.scenes[0];
    if (!next) {
      onNext();
      return;
    }
    const spec = sceneOfChosen(next);
    if (!spec) {
      onSceneDone();
      return;
    }
    setScene({
      spec,
      skill: skillOfScene(next.request, item.ref.skill),
      then: onSceneDone,
      // A solution opened by the button closes back to this screen, but this one goes on.
      doneLabel: spec.purpose === 'reveal' ? th.scenes.player.done.remediate : undefined,
    });
  };

  const showWorked = () => {
    if (!closed) return;
    const request = workedRequest(item, closed.answer, closed.outcome.classification);
    const spec = sceneOrNull(request);
    if (!spec) return;
    setScene({
      spec,
      skill: item.ref.skill,
      then: () => learner.dispatch({ type: 'note_worked', request }),
    });
  };

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
        {/* In landscape the strip takes this column only: the answer slot needs its full height. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PathStrip note={stripNote(profile)} />
          {/* Focusable, so a keyboard can scroll it once the answer boxes are closed and take no focus. */}
          <main
            ref={scroller}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
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
        </div>

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
                turn={closed.turn}
                thinking={llm && thinking}
                waiting={waiting}
                onNext={() => void goOn()}
                onShowWorked={showWorked}
              />
            ) : isChoice ? (
              <div className="flex h-full flex-col gap-2">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <HintButton level={hintLevel} onHint={askHint} />
                  <HelpButton onHelp={askHelp} />
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
                {/* Fixed tracks: the hint label changes length as it steps, and nothing else moves. */}
                <div
                  className={`grid gap-2 ${canBeUndefined(item) ? 'grid-cols-[1fr_auto_auto]' : 'grid-cols-[1fr_auto]'}`}
                >
                  <HintButton level={hintLevel} onHint={askHint} />
                  <HelpButton onHelp={askHelp} />
                  {canBeUndefined(item) && (
                    <Button
                      variant={draft.isUndefined ? 'selected' : 'secondary'}
                      size="compact"
                      aria-pressed={draft.isUndefined}
                      className="text-sm"
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

      {scene && (
        <LazyScene
          modal
          spec={scene.spec}
          title={sceneTitle(scene.spec, scene.skill)}
          doneLabel={scene.doneLabel}
          onView={(view) => logView(scene.spec, view)}
          onDone={() => {
            setScene(null);
            scene.then?.();
          }}
        />
      )}
    </div>
  );
}

function canBeUndefined({ kind }: MatrixItem): boolean {
  return kind === 'matrix_or_undefined' || kind === 'dims_or_undefined';
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
      size="compact"
      disabled={level === 3}
      className="text-sm"
      onClick={onHint}
    >
      <BulbIcon className="size-4 shrink-0 text-brand" />
      {label}
      {level > 0 && <span className="font-matrix text-muted tabular-nums">{level}/3</span>}
    </Button>
  );
}

/** Plays the skill's concept scene on another example, so it never gives this item away (SPEC §4). */
function HelpButton({ onHelp }: { onHelp(): void }) {
  return (
    <Button variant="secondary" size="compact" className="text-sm" onClick={onHelp}>
      {th.session.help}
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

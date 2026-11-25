'use client';

import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { Affixed } from '@/components/input/Affixed';
import { AnswerBox } from '@/components/input/AnswerBox';
import { ChoiceButtons } from '@/components/input/ChoiceButtons';
import { DimsInput } from '@/components/input/DimsInput';
import { Keypad } from '@/components/input/Keypad';
import { MatrixInput } from '@/components/input/MatrixInput';
import { VectorInput } from '@/components/input/VectorInput';
import { ItemPrompt } from '@/components/learn/ItemPrompt';
import { LoadingScreen } from '@/components/learn/LoadingScreen';
import { componentsOf, type AnswerAffix } from '@/components/topics';
import { Button, LinkButton } from '@/components/ui/Button';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { storeAnswer } from '@/lib/core/answerJson';
import { fillTokens } from '@/lib/core/tokens';
import type { Item } from '@/lib/core/types';
import { rebuildItem } from '@/lib/director/items';
import { hasPretestMarks } from '@/lib/learner/pretest';
import {
  emptyDraft,
  focusBox,
  moveActive,
  pickChoice,
  pressKey,
  readiness,
  takesRoot,
  toggleUndefined,
  type Direction,
  type Draft,
  type KeypadKey,
} from '@/lib/practice/draft';
import { actionFromKey } from '@/lib/practice/keyboard';
import {
  ASSESSED_TOPIC,
  assessedItemsDone,
  testBlock,
  type AssessmentAnswer,
  type AssessmentForm,
  type AssessmentPhase,
  type AssessmentResult,
  type AssessmentScore,
  type AssessmentStatus,
} from '@/lib/sync/assessment';
import { packOf } from '@/lib/topics';
import { Mascot } from './Mascot';
import { PosttestReport, PretestReport } from './TestReport';
import { learner, useLearner, useRequiredProfile } from './useLearner';

// No feedback and no hints here (RESEARCH §4): an answer is kept and the next item opens. What the test
// led to is shown only once it has been sent.

type Stage =
  | { name: 'loading' }
  | { name: 'unavailable' }
  | { name: 'intro'; form: AssessmentForm }
  | { name: 'taking'; items: Item[]; startedAt: number }
  | { name: 'sending'; items: Item[]; startedAt: number }
  | { name: 'failed'; items: Item[]; startedAt: number }
  | { name: 'done'; result: AssessmentScore };

const DIRECTIONS: readonly string[] = ['left', 'right', 'up', 'down'];

/** RESEARCH §4: 14 items in about 20 minutes. */
const minutesFor = (items: number) => Math.round((items * 10) / 7);

/**
 * The answers given so far, kept in this tab until the test is sent, so a reload or a locked phone does
 * not throw away twenty minutes. The same form and the same start time carry on; nothing is marked here.
 */
interface InProgress {
  /** The form's refs as the server sent them, so only the same form is ever picked up. */
  refs: string;
  startedAt: number;
  answers: AssessmentAnswer[];
}

const progressKey = (phase: AssessmentPhase, student: string) => `math:test:${phase}:${student}`;

function readProgress(key: string, form: AssessmentForm): InProgress | null {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(key) ?? 'null') as InProgress | null;
    const fits =
      saved?.refs === JSON.stringify(form.refs) &&
      saved.answers.length > 0 &&
      saved.answers.length < form.refs.length;
    return fits ? saved : null;
  } catch {
    return null;
  }
}

function writeProgress(key: string, progress: InProgress | null): void {
  try {
    if (progress) window.sessionStorage.setItem(key, JSON.stringify(progress));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Blocked storage: the test still works, it just cannot be picked up after a reload.
  }
}

function TestItem({
  item,
  itemNo,
  total,
  onAnswer,
}: {
  item: Item;
  itemNo: number;
  total: number;
  onAnswer(answer: AssessmentAnswer['answer'], timeMs: number): void;
}) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(item));
  const [openedAt] = useState(() => Date.now());
  const state = readiness(item, draft);
  const isChoice = item.kind === 'choice';
  const canBeUndefined = item.kind === 'matrix_or_undefined' || item.kind === 'dims_or_undefined';
  const isLast = itemNo === total;
  const affix = componentsOf(item.ref.topic).answerAffix?.(item);
  const selectBox = (box: number) => setDraft((current) => focusBox(current, box));

  const send = (answer: AssessmentAnswer['answer']) => onAnswer(answer, Date.now() - openedAt);
  const sendIfReady = () => {
    if (state.ready) send(storeAnswer(state.answer));
  };

  // The same keys as practice (SPEC §5): a computer lab's keyboard types the answer and Enter sends it.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action = actionFromKey(event.code, event.key);
    if (action === null) return;
    // Enter on a focused button should press that button, not send the answer.
    const onButton =
      event.target instanceof HTMLElement && event.target.closest('button:not([data-box])');
    if (action === 'send' && onButton) return;
    event.preventDefault();
    if (action === 'send') sendIfReady();
    else if (isChoice) return;
    else if (DIRECTIONS.includes(action)) {
      setDraft((current) => moveActive(current, item, action as Direction));
    } else setDraft((current) => pressKey(current, item, action as KeypadKey));
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-line bg-surface px-4 py-1.5">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-sm font-semibold">
              {fillTokens(th.test.progress, { n: String(itemNo), total: String(total) })}
            </p>
            <span
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={itemNo}
              aria-label={th.test.progress}
              className="h-2 overflow-hidden rounded-full bg-sunken"
            >
              <span
                className="block h-full origin-left rounded-full bg-brand"
                style={{ transform: `scaleX(${itemNo / total})` }}
              />
            </span>
          </div>
          {/* Kept apart from the answers and quiet, so a skip is never pressed for an answer. */}
          <Button
            variant="quiet"
            size="compact"
            className="shrink-0 text-sm underline"
            onClick={() => send(null)}
          >
            {th.test.skip}
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mx-auto flex max-w-lg flex-col gap-3 motion-safe:animate-rise">
          <ItemPrompt item={item} />
          {!isChoice && (
            <div className="flex justify-center">
              {item.kind === 'matrix' || item.kind === 'matrix_or_undefined' ? (
                <MatrixInput
                  grid={item.grid ?? { rows: 1, cols: 1 }}
                  draft={draft}
                  onSelect={selectBox}
                />
              ) : item.kind === 'dims' || item.kind === 'dims_or_undefined' ? (
                <DimsInput draft={draft} onSelect={selectBox} />
              ) : item.kind === 'vector' ? (
                <VectorInput draft={draft} onSelect={selectBox} />
              ) : (
                <MaybeAffixed affix={affix}>
                  <AnswerBox
                    text={draft.cells[0]}
                    label={th.session.box.answer}
                    active
                    sizeClass="h-14 w-36"
                    onSelect={() => selectBox(0)}
                  />
                </MaybeAffixed>
              )}
            </div>
          )}
        </div>
      </main>

      <div className="shrink-0 border-t border-line bg-sunken pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg flex-col gap-2 px-4 py-2">
          {canBeUndefined && (
            <Button
              variant={draft.isUndefined ? 'selected' : 'secondary'}
              size="compact"
              aria-pressed={draft.isUndefined}
              className="text-sm"
              onClick={() => setDraft(toggleUndefined)}
            >
              {th.session.undefined}
            </Button>
          )}
          {isChoice ? (
            <>
              <ChoiceButtons
                options={item.options ?? []}
                topic={item.ref.topic}
                selected={draft.choice}
                onPick={(id) => setDraft((current) => pickChoice(current, id))}
              />
              <Button
                variant={state.ready ? 'primary' : 'secondary'}
                aria-disabled={!state.ready}
                onClick={sendIfReady}
              >
                {isLast ? th.test.finish : th.test.next}
              </Button>
            </>
          ) : (
            <Keypad
              digitsOnly={item.kind === 'dims' || item.kind === 'dims_or_undefined'}
              withRoot={takesRoot(item)}
              sendReady={state.ready}
              onKey={(key) => setDraft((current) => pressKey(current, item, key))}
              onSend={sendIfReady}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MaybeAffixed({
  affix,
  children,
}: {
  affix: AnswerAffix | null | undefined;
  children: ReactNode;
}) {
  return affix ? <Affixed affix={affix}>{children}</Affixed> : children;
}

/** The post-test result, beside the pre-test's score when there is one. */
function PosttestDone({ score }: { score: AssessmentScore }) {
  const [pre, setPre] = useState<AssessmentScore | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void fetch('/api/assessment/status')
      .then((response) => (response.ok ? (response.json() as Promise<AssessmentStatus>) : null))
      .then((status) => {
        if (live) setPre(status?.pre ?? null);
      })
      .catch(() => {
        if (live) setPre(null);
      });
    return () => {
      live = false;
    };
  }, []);
  if (pre === undefined) return <LoadingScreen />;
  return <PosttestReport score={score} pre={pre} topic={ASSESSED_TOPIC} />;
}

function Notice({ mood, children }: { mood?: 'oops' | 'thinking'; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <Mascot mood={mood} />
      {children}
    </main>
  );
}

export function TestScreen({ phase }: { phase: AssessmentPhase }) {
  const profile = useRequiredProfile();
  const { mode, account } = useLearner();
  const [stage, setStage] = useState<Stage>({ name: 'loading' });
  const [answers, setAnswers] = useState<AssessmentAnswer[]>([]);
  // The refs of the form being taken, as the server sent them: what kept progress is matched against.
  const [formRefs, setFormRefs] = useState('');
  const key = profile ? progressKey(phase, profile.student.id) : '';

  useEffect(() => {
    if (mode !== 'account') return;
    let live = true;
    void fetch(`/api/assessment/${phase}`)
      .then((response) => (response.ok ? (response.json() as Promise<AssessmentForm>) : null))
      .then((form) => {
        if (!live) return;
        if (!form) setStage({ name: 'unavailable' });
        else if (form.done) setStage({ name: 'done', result: form.done });
        else setStage({ name: 'intro', form });
      })
      .catch(() => {
        if (live) setStage({ name: 'unavailable' });
      });
    return () => {
      live = false;
    };
  }, [phase, mode]);

  const items = useMemo(() => ('items' in stage ? stage.items : null), [stage]);

  const submit = async (all: AssessmentAnswer[], current: Item[], startedAt: number) => {
    setStage({ name: 'sending', items: current, startedAt });
    try {
      // The server counts practice from what it has received, so anything still queued goes first.
      await learner.flush();
      const response = await fetch(`/api/assessment/${phase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startedAt, answers: all }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const result = (await response.json()) as AssessmentResult;
      if (result.profile) learner.adopt(result.profile);
      writeProgress(key, null);
      setStage({ name: 'done', result });
    } catch {
      setStage({ name: 'failed', items: current, startedAt });
    }
  };

  if (!profile) return <LoadingScreen />;
  if (mode !== 'account') {
    return (
      <Notice>
        <p>{th.test.guest}</p>
        <LinkButton href="/settings" className="w-full">
          {th.settings.signIn}
        </LinkButton>
      </Notice>
    );
  }
  if (stage.name === 'loading') return <LoadingScreen />;
  if (stage.name === 'unavailable') {
    return (
      <Notice mood="oops">
        <p>{th.test.unavailable}</p>
        <LinkButton href="/learn" className="w-full">
          {th.test.goLearn}
        </LinkButton>
      </Notice>
    );
  }
  if (stage.name === 'done') {
    if (phase === 'post') return <PosttestDone score={stage.result} />;
    // A fixed path does not use the pre-test, and a result that never reached the profile has nothing
    // true to say about the path: both show the score alone.
    const marked = hasPretestMarks(profile, ASSESSED_TOPIC) || stage.result.score === 0;
    return (
      <PretestReport
        profile={profile}
        score={stage.result}
        topic={ASSESSED_TOPIC}
        usesPretest={account?.condition !== 'fixed' && marked}
      />
    );
  }

  if (stage.name === 'intro') {
    const practised = assessedItemsDone(profile);
    const blocked = testBlock(phase, practised);
    if (blocked) {
      return (
        <Notice>
          <p>
            {fillTokens(th.test.blocked[blocked], {
              n: String(CONFIG.postTestAfterItems),
              done: String(practised),
            })}
          </p>
          <LinkButton href="/learn" className="w-full">
            {th.test.goLearn}
          </LinkButton>
        </Notice>
      );
    }
    const { form } = stage;
    const saved = readProgress(key, form);
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 py-8">
        <Mascot className="size-16 -rotate-3" />
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted">
            {fillTokens(th.test.topic, { topic: packOf(ASSESSED_TOPIC).titleTh })}
          </p>
          <h1 className="text-3xl leading-snug font-semibold">
            <span className="marker">{th.test.titles[phase]}</span>
          </h1>
        </div>
        <p className="font-medium">
          {fillTokens(th.test.meta, {
            n: String(form.refs.length),
            minutes: String(minutesFor(form.refs.length)),
          })}
        </p>
        <p className="text-muted">{th.test.intro[phase]}</p>
        <Button
          className="mt-auto w-full"
          onClick={() => {
            const built = form.refs.map(rebuildItem);
            if (built.some((item) => item === null)) {
              setStage({ name: 'unavailable' });
              return;
            }
            const refs = JSON.stringify(form.refs);
            const startedAt = saved?.startedAt ?? Date.now();
            setFormRefs(refs);
            setAnswers(saved?.answers ?? []);
            setStage({ name: 'taking', items: built as Item[], startedAt });
          }}
        >
          {saved
            ? fillTokens(th.test.resume, { n: String(saved.answers.length + 1) })
            : th.test.begin}
        </Button>
      </main>
    );
  }

  const current = items ?? [];
  if (stage.name === 'taking') {
    const index = answers.length;
    const item = current[index];
    return (
      <TestItem
        key={index}
        item={item}
        itemNo={index + 1}
        total={current.length}
        onAnswer={(answer, timeMs) => {
          const all = [...answers, { itemNo: index + 1, answer, timeMs }];
          setAnswers(all);
          writeProgress(key, { refs: formRefs, startedAt: stage.startedAt, answers: all });
          if (all.length === current.length) void submit(all, current, stage.startedAt);
        }}
      />
    );
  }

  return (
    <Notice mood={stage.name === 'failed' ? 'oops' : 'thinking'}>
      {stage.name === 'failed' ? (
        <>
          <p role="alert">{th.test.failed}</p>
          <Button className="w-full" onClick={() => void submit(answers, current, stage.startedAt)}>
            {th.common.retry}
          </Button>
        </>
      ) : (
        <p role="status">{th.common.loading}</p>
      )}
    </Notice>
  );
}

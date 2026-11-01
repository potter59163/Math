'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnswerBox } from '@/components/input/AnswerBox';
import { ChoiceButtons } from '@/components/input/ChoiceButtons';
import { DimsInput } from '@/components/input/DimsInput';
import { Keypad } from '@/components/input/Keypad';
import { MatrixInput } from '@/components/input/MatrixInput';
import { ItemPrompt } from '@/components/learn/ItemPrompt';
import { LoadingScreen } from '@/components/learn/LoadingScreen';
import { Button, LinkButton } from '@/components/ui/Button';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { storeAnswer } from '@/lib/core/answerJson';
import { fillTokens } from '@/lib/core/tokens';
import { rebuildItem } from '@/lib/director/items';
import {
  emptyDraft,
  focusBox,
  pickChoice,
  pressKey,
  readiness,
  toggleUndefined,
  type Draft,
} from '@/lib/practice/draft';
import {
  testBlock,
  type AssessmentAnswer,
  type AssessmentForm,
  type AssessmentPhase,
  type AssessmentResult,
  type AssessmentScore,
} from '@/lib/sync/assessment';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { Mascot } from './Mascot';
import { learner, useLearner, useRequiredProfile } from './useLearner';

// No feedback and no hints here (RESEARCH §4): an answer is kept and the next item opens.

type Stage =
  | { name: 'loading' }
  | { name: 'unavailable' }
  | { name: 'intro'; form: AssessmentForm }
  | { name: 'taking'; items: MatrixItem[]; startedAt: number }
  | { name: 'sending'; items: MatrixItem[]; startedAt: number }
  | { name: 'failed'; items: MatrixItem[]; startedAt: number }
  | { name: 'done'; result: AssessmentScore };

function TestItem({
  item,
  itemNo,
  total,
  onAnswer,
}: {
  item: MatrixItem;
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

  const send = (answer: AssessmentAnswer['answer']) => onAnswer(answer, Date.now() - openedAt);

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-line bg-surface px-4 py-2">
        <div className="mx-auto flex max-w-lg flex-col gap-1">
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
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          <ItemPrompt item={item} />
          {!isChoice && (
            <div className="flex justify-center">
              {item.kind === 'matrix' || item.kind === 'matrix_or_undefined' ? (
                <MatrixInput
                  grid={item.grid ?? { rows: 1, cols: 1 }}
                  draft={draft}
                  onSelect={(box) => setDraft((current) => focusBox(current, box))}
                />
              ) : item.kind === 'dims' || item.kind === 'dims_or_undefined' ? (
                <DimsInput
                  draft={draft}
                  onSelect={(box) => setDraft((current) => focusBox(current, box))}
                />
              ) : (
                <AnswerBox
                  text={draft.cells[0]}
                  label={th.session.box.answer}
                  active
                  sizeClass="h-14 w-36"
                  onSelect={() => setDraft((current) => focusBox(current, 0))}
                />
              )}
            </div>
          )}
        </div>
      </main>

      <div className="shrink-0 border-t border-line bg-sunken pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg flex-col gap-2 px-4 py-2">
          <div className={`grid gap-2 ${canBeUndefined ? 'grid-cols-2' : ''}`}>
            <Button
              variant="secondary"
              size="compact"
              className="text-sm"
              onClick={() => send(null)}
            >
              {th.test.skip}
            </Button>
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
          </div>
          {isChoice ? (
            <>
              <ChoiceButtons
                options={item.options ?? []}
                selected={draft.choice}
                onPick={(id) => setDraft((current) => pickChoice(current, id))}
              />
              <Button
                aria-disabled={!state.ready}
                onClick={() => {
                  if (state.ready) send(storeAnswer(state.answer));
                }}
              >
                {isLast ? th.test.finish : th.test.next}
              </Button>
            </>
          ) : (
            <Keypad
              digitsOnly={item.kind === 'dims' || item.kind === 'dims_or_undefined'}
              sendReady={state.ready}
              onKey={(key) => setDraft((current) => pressKey(current, item, key))}
              onSend={() => {
                if (state.ready) send(storeAnswer(state.answer));
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Result({ phase, result }: { phase: AssessmentPhase; result: AssessmentScore }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
      <Mascot className="size-20 -rotate-3" mood="cheer" />
      <h1 className="text-2xl font-bold">{th.test.resultTitle}</h1>
      <p className="font-matrix text-3xl font-bold tabular-nums">
        {fillTokens(th.test.result, { score: String(result.score), total: String(result.total) })}
      </p>
      <p className="text-muted">{th.test.resultNote[phase]}</p>
      <LinkButton href="/learn" className="mt-auto w-full">
        {th.test.goLearn}
      </LinkButton>
    </main>
  );
}

export function TestScreen({ phase }: { phase: AssessmentPhase }) {
  const profile = useRequiredProfile();
  const { mode } = useLearner();
  const [stage, setStage] = useState<Stage>({ name: 'loading' });
  const [answers, setAnswers] = useState<AssessmentAnswer[]>([]);

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

  const submit = async (all: AssessmentAnswer[], current: MatrixItem[], startedAt: number) => {
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
      setStage({ name: 'done', result });
    } catch {
      setStage({ name: 'failed', items: current, startedAt });
    }
  };

  if (!profile) return <LoadingScreen />;
  if (mode !== 'account') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Mascot />
        <p>{th.test.guest}</p>
        <LinkButton href="/settings" className="w-full">
          {th.settings.signIn}
        </LinkButton>
      </main>
    );
  }
  if (stage.name === 'loading') return <LoadingScreen />;
  if (stage.name === 'unavailable') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Mascot mood="oops" />
        <p>{th.test.unavailable}</p>
        <LinkButton href="/learn" className="w-full">
          {th.test.goLearn}
        </LinkButton>
      </main>
    );
  }
  if (stage.name === 'done') return <Result phase={phase} result={stage.result} />;

  if (stage.name === 'intro') {
    const blocked = testBlock(phase, profile.itemsDone);
    if (blocked) {
      return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <Mascot />
          <p>
            {fillTokens(th.test.blocked[blocked], {
              n: String(CONFIG.postTestAfterItems),
              done: String(profile.itemsDone),
            })}
          </p>
          <LinkButton href="/learn" className="w-full">
            {th.test.goLearn}
          </LinkButton>
        </main>
      );
    }
    const { refs } = stage.form;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
        <Mascot className="size-20" />
        <h1 className="text-2xl font-bold">{th.test.titles[phase]}</h1>
        <p className="text-muted">{th.test.intro[phase]}</p>
        <Button
          className="mt-auto w-full"
          onClick={() => {
            const built = refs.map(rebuildItem);
            if (built.some((item) => item === null)) {
              setStage({ name: 'unavailable' });
              return;
            }
            setStage({ name: 'taking', items: built as MatrixItem[], startedAt: Date.now() });
          }}
        >
          {th.test.begin}
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
          if (all.length === current.length) void submit(all, current, stage.startedAt);
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <Mascot mood={stage.name === 'failed' ? 'oops' : 'thinking'} />
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
    </main>
  );
}

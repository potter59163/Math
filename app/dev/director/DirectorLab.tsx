'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { th } from '@/lib/content/th';
import { noteFor } from '@/lib/director/pathStep';
import { resolveTokens } from '@/lib/director/tokens';
import type { Candidate, NextTurn, PathKind, Profile } from '@/lib/director/types';
import { CATALOG } from '@/lib/topics/matrix/misconceptions';
import { SKILLS } from '@/lib/topics/matrix/skills';
import { nextItemOf, runScenario, SCENARIOS, type LabStep, type Mark } from './scenarios';

// Labels here are English on purpose: this page is a developer tool. Student copy comes from th.ts.

const FIELD =
  'h-11 w-full rounded-md border border-neutral-400 bg-transparent px-3 dark:border-neutral-600';
const BUTTON =
  'min-h-11 rounded-md border border-neutral-400 px-3 font-medium hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800';
const CELL = 'border border-neutral-300 px-2 py-1 align-top dark:border-neutral-700';

const NOTE_KINDS = Object.keys(th.pathNotes) as PathKind[];
const NAMED_NOTES: PathKind[] = ['probe', 'pretest_probe', 'remediate'];

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {head.map((label) => (
              <th key={label} className={`${CELL} text-left`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) => (
                <td key={column} className={CELL}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function nextText({ skill, level, purpose, target, targetVariant, hintLevel }: Candidate['next']) {
  const aim = target ? ` → ${target}${targetVariant ? `:${targetVariant}` : ''}` : '';
  return `${skill} L${level} ${purpose}${aim}${hintLevel ? ' + hint L1' : ''}`;
}

function CandidatesTable({ turn }: { turn: NextTurn }) {
  return (
    <Table
      head={['id', 'rule', 'score', 'scene', 'next', 'note kind', 'ruleReason']}
      rows={turn.candidates.map((candidate) => [
        <span key="id" className={candidate.id === turn.choice ? 'font-bold' : ''}>
          {candidate.id === turn.choice ? `▶ ${candidate.id}` : candidate.id}
        </span>,
        candidate.rule,
        candidate.score,
        candidate.scene
          ? `${candidate.scene.template} (${candidate.scene.request.kind}): ${candidate.scene.beats.join(' · ')}`
          : '–',
        nextText(candidate.next),
        candidate.stepKind,
        candidate.ruleReason,
      ])}
    />
  );
}

function Decision({ turn }: { turn: NextTurn }) {
  return (
    <Panel title="Decision">
      <p>
        <strong>{turn.trigger}</strong> · {turn.mode} · reveal allowed: {String(turn.revealAllowed)}
        {turn.stuck && ' · teacher alert'}
        {turn.fallback && ` · fallback: ${turn.fallback}`}
      </p>
      <p>
        Next item: {turn.next ? `${turn.next.skill} L${turn.next.difficulty}` : 'the open item'}
      </p>
      <p>Scenes: {turn.scenes.map(({ template }) => template).join(', ') || 'none'}</p>
      <p>
        Path step: {turn.pathStep.kind} →{' '}
        <span data-note>{turn.pathStep.note || '(no reason)'}</span>
      </p>
      <p>Reason for the teacher: {turn.reason}</p>
      <CandidatesTable turn={turn} />
    </Panel>
  );
}

function LastAttempt({ step }: { step: LabStep }) {
  const { item, answer, outcome } = step;
  const tokens = resolveTokens(item, answer, { revealAllowed: true });
  return (
    <Panel title="Last answer">
      <p>
        {item.ref.skill} L{item.ref.difficulty}
        {item.ref.target && ` → ${item.ref.target}`} · seed {item.ref.seed}
      </p>
      <p>Classification: {JSON.stringify(outcome.classification)}</p>
      <p>
        XP +{outcome.xp}
        {outcome.bonusXp > 0 && ` +${outcome.bonusXp}`} · level change {outcome.levelChange}
        {outcome.skillPassed && ` · passed ${outcome.skillPassed}`}
        {outcome.resolved && ` · fixed ${outcome.resolved}`}
        {outcome.stuck && ' · stuck'}
      </p>
      <p className="break-words">Tokens: {JSON.stringify(tokens)}</p>
    </Panel>
  );
}

function Learner({ profile }: { profile: Profile }) {
  const skills = SKILLS.filter(({ id }) => profile.skills[id]);
  const bugs = CATALOG.filter(({ id }) => profile.misconceptions[id]);
  return (
    <Panel title="Learner">
      <p>
        items {profile.itemsDone} · counter {profile.counter} · XP {profile.xp} · last review at{' '}
        {profile.lastReviewAt}
      </p>
      <Table
        head={['skill', 'P(L)', 'level', 'passed', 'clean', 'streak', 'stuck', 'seen at']}
        rows={skills.map(({ id }) => {
          const state = profile.skills[id]!;
          return [
            id,
            state.pKnown.toFixed(3),
            state.level,
            String(state.passed),
            state.attempts.filter(({ clean }) => clean).length,
            state.wrongStreak,
            String(state.stuck),
            state.lastSeen,
          ];
        })}
      />
      {bugs.length > 0 && (
        <Table
          head={['misconception', 'status', 'count', 'fix streak', 'scenes', 'variant', 'to fix']}
          rows={bugs.map(({ id }) => {
            const state = profile.misconceptions[id]!;
            return [
              id,
              state.status,
              state.count,
              state.fixStreak,
              state.scenesSeen,
              state.variant ?? '–',
              state.itemsToResolve ?? '–',
            ];
          })}
        />
      )}
    </Panel>
  );
}

function Steps({ steps }: { steps: LabStep[] }) {
  return (
    <Panel title="Items so far">
      <Table
        head={['#', 'item', 'answered', 'chosen', 'note']}
        rows={steps.map(({ item, outcome, turn }, index) => [
          index + 1,
          `${item.ref.skill} L${item.ref.difficulty}${item.ref.target ? ` → ${item.ref.target}` : ''}`,
          outcome.classification.type,
          `${turn.choice} ${turn.candidates.find(({ id }) => id === turn.choice)?.rule ?? ''}`,
          turn.pathStep.note,
        ])}
      />
    </Panel>
  );
}

function AllNotes() {
  const notes = NOTE_KINDS.flatMap((kind) =>
    NAMED_NOTES.includes(kind) ? CATALOG.map(({ id }) => noteFor(kind, id)) : [noteFor(kind)],
  ).filter((note) => note !== '');
  return (
    <Panel title="Every note, at the width of PathStrip on a 360px phone">
      <ul className="flex flex-col gap-1">
        {notes.map((note) => (
          <li key={note} data-note-sample className="w-[328px] truncate text-sm leading-6">
            {note}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function DirectorLab() {
  const [key, setKey] = useState(SCENARIOS[0].key);
  const [extra, setExtra] = useState<Mark[]>([]);
  const scenario = SCENARIOS.find((candidate) => candidate.key === key) ?? SCENARIOS[0];
  const run = useMemo(() => runScenario(scenario, extra), [scenario, extra]);
  const lastStep = run.steps[run.steps.length - 1];
  const nextItem = nextItemOf(run.profile);
  const answerWith = (mark: Mark) => setExtra((marks) => [...marks, mark]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Director playground</h1>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Scenario</span>
        <select
          className={FIELD}
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
            setExtra([]);
          }}
        >
          {SCENARIOS.map(({ key: value, title }) => (
            <option key={value} value={value}>
              {title}
            </option>
          ))}
        </select>
      </label>

      {run.turn ? (
        <Decision turn={run.turn} />
      ) : (
        <Panel title="Decision">
          <p>No clip and no answer yet: the first item is open.</p>
        </Panel>
      )}
      {lastStep && <LastAttempt step={lastStep} />}

      <Panel title="Answer the next item">
        <p>{nextItem ? `${nextItem.ref.skill} L${nextItem.ref.difficulty}` : 'No open item'}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON} onClick={() => answerWith('right')}>
            Right
          </button>
          <button type="button" className={BUTTON} onClick={() => answerWith('slip')}>
            Slip
          </button>
          <button type="button" className={BUTTON} onClick={() => answerWith('unknown')}>
            Unknown
          </button>
          {[...new Set(nextItem?.diagnostics.map(({ id }) => id))].map((id) => (
            <button
              key={id}
              type="button"
              className={BUTTON}
              onClick={() => answerWith({ bug: id })}
            >
              {id}
            </button>
          ))}
        </div>
      </Panel>

      <Learner profile={run.profile} />
      <Steps steps={run.steps} />
      <AllNotes />
    </main>
  );
}

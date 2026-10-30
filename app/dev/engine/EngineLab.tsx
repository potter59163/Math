'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo, useState, type ReactNode } from 'react';
import { th } from '@/lib/content/th';
import { classify } from '@/lib/core/classify';
import { parseAnswer, type ParseResult, type RawAnswer } from '@/lib/core/parse';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, DiagnosticAnswer, Dims, Level, Matrix } from '@/lib/core/types';
import { generateDetailed, regenerate } from '@/lib/topics/matrix/generators';
import {
  CATALOG,
  catalogEntry,
  probeLevel,
  probeLevels,
  sceneFor,
  variantsOf,
} from '@/lib/topics/matrix/misconceptions';
import { validateMatrixItem } from '@/lib/topics/matrix/rules';
import { SKILLS, levelsOf, skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixData, MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';
import { workedSteps } from '@/lib/topics/matrix/worked';

// Labels here are English on purpose: this page is a developer tool. Student copy comes from th.ts.

const FIELD =
  'h-11 w-full rounded-md border border-neutral-400 bg-transparent px-3 dark:border-neutral-600';
const BUTTON =
  'min-h-11 rounded-md border border-neutral-400 px-3 font-medium hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800';

const minus = (text: string) => text.replace(/-/g, '−');

interface TargetChoice {
  key: string;
  id: MisconceptionId;
  variant?: string;
}

function targetsFor(skill: SkillId): TargetChoice[] {
  return CATALOG.filter((entry) => entry.skills.includes(skill)).flatMap((entry) =>
    variantsOf(entry.id).flatMap((variant) => {
      const whole = { key: entry.id, id: entry.id };
      if (variant === undefined) return [whole];
      const named = { key: `${entry.id}:${variant}`, id: entry.id, variant };
      return variant === variantsOf(entry.id)[0] ? [whole, named] : [named];
    }),
  );
}

type Generated =
  | {
      ok: true;
      item: MatrixItem;
      tries: number;
      requestedLevel: Level;
      valid: ReturnType<typeof validateMatrixItem>;
      regenerates: boolean;
    }
  | { ok: false; message: string };

function run(
  skill: SkillId,
  level: Level,
  target: TargetChoice | undefined,
  seed: number,
): Generated {
  try {
    // Same path as the director: every target goes through probeLevel first (MISCONCEPTIONS §4.1).
    const difficulty = target ? probeLevel(skill, target.id, level, target.variant) : level;
    const { item, tries } = generateDetailed({
      skill,
      difficulty,
      seed,
      target: target?.id,
      targetVariant: target?.variant,
    });
    return {
      ok: true,
      item,
      tries,
      requestedLevel: level,
      valid: validateMatrixItem(item),
      regenerates: JSON.stringify(regenerate(item.ref)) === JSON.stringify(item),
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function MatrixText({ value, label }: { value: Matrix; label?: string }) {
  return (
    <figure className="flex items-center gap-2">
      {label && <figcaption className="font-medium">{label} =</figcaption>}
      <div
        className="grid w-fit gap-x-4 border-x-2 border-current px-2 font-matrix tabular-nums"
        style={{ gridTemplateColumns: `repeat(${value[0].length}, auto)` }}
      >
        {value.flat().map((cell, index) => (
          <span key={index} className="text-right">
            {minus(cell.toString())}
          </span>
        ))}
      </div>
    </figure>
  );
}

function Formula({ latex }: { latex: string }) {
  const html = useMemo(() => katex.renderToString(latex, { throwOnError: false }), [latex]);
  return <div className="overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: html }} />;
}

function shownMatrices(data: MatrixData): { label: string; value: Matrix }[] {
  switch (data.form) {
    case 'addsub':
    case 'combo':
    case 'mult':
    case 'noncomm_pair':
    case 'det_sum':
      return [
        { label: 'A', value: data.A },
        { label: 'B', value: data.B },
      ];
    case 'noncomm_find_ba':
      return [
        { label: 'A', value: data.A },
        { label: 'B', value: data.B },
        { label: 'AB', value: data.AB },
      ];
    case 'dim':
    case 'index':
    case 'transpose':
    case 'scalar':
    case 'det2':
    case 'det3':
    case 'invertible':
    case 'inv2':
      return [{ label: 'A', value: data.A }];
    default:
      return [];
  }
}

function answerText(answer: DiagnosticAnswer): string {
  switch (answer.kind) {
    case 'matrix':
      return minus(JSON.stringify(answer.value).replace(/"/g, ''));
    case 'scalar':
      return minus(answer.value.toString());
    case 'dims':
      return `${answer.rows}×${answer.cols}`;
    case 'choice':
      return answer.id;
    case 'undefined':
      return 'undefined';
    case 'any_matrix':
      return 'ANY_MATRIX';
  }
}

interface Draft {
  cells: string[][];
  text: string;
  rows: string;
  cols: string;
  choice: string | null;
  isUndefined: boolean;
}

function emptyDraft({ rows, cols }: Dims): Draft {
  return {
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    text: '',
    rows: '',
    cols: '',
    choice: null,
    isUndefined: false,
  };
}

function draftFrom(answer: DiagnosticAnswer, grid: Dims): Draft {
  const draft = emptyDraft(grid);
  switch (answer.kind) {
    case 'matrix':
      return { ...draft, cells: answer.value.map((row) => row.map((cell) => cell.toString())) };
    case 'any_matrix':
      return {
        ...draft,
        cells: draft.cells.map((row, i) => row.map((_, j) => String(i + j + 1))),
      };
    case 'scalar':
      return { ...draft, text: answer.value.toString() };
    case 'dims':
      return { ...draft, rows: String(answer.rows), cols: String(answer.cols) };
    case 'choice':
      return { ...draft, choice: answer.id };
    case 'undefined':
      return { ...draft, isUndefined: true };
  }
}

function toRaw(draft: Draft, item: MatrixItem): RawAnswer | null {
  if (draft.isUndefined) return { type: 'undefined' };
  switch (item.kind) {
    case 'matrix':
    case 'matrix_or_undefined':
      return { type: 'matrix', cells: draft.cells };
    case 'scalar':
    case 'cell':
      return { type: 'number', text: draft.text };
    case 'dims':
    case 'dims_or_undefined':
      return { type: 'dims', rows: draft.rows, cols: draft.cols };
    case 'choice':
      return draft.choice === null ? null : { type: 'choice', id: draft.choice };
  }
}

function ClassificationView({
  item,
  parsed,
}: {
  item: MatrixItem;
  parsed: ParseResult<Answer> | null;
}) {
  if (parsed === null) return <p>Pick an option.</p>;
  if (!parsed.ok) {
    const where = parsed.cell ? ` at row ${parsed.cell[0]}, column ${parsed.cell[1]}` : '';
    return <p>Not parsed: {parsed.reason + where}</p>;
  }
  const result = classify(item, parsed.value);
  return (
    <div className="flex flex-col gap-1">
      <p className="font-semibold" data-testid="classification">
        {result.type}
        {result.type === 'misconception' &&
          `: ${result.id}${result.variant ? ` / ${result.variant}` : ''}`}
        {result.type === 'slip' && ` at row ${result.cell[0]}, column ${result.cell[1]}`}
      </p>
      {result.type === 'misconception' && (
        <>
          <p>{catalogEntry(result.id as MisconceptionId).nameTh}</p>
          <p className="text-sm">
            hint L2: {th.hints[catalogEntry(result.id as MisconceptionId).hintKey]}
          </p>
        </>
      )}
    </div>
  );
}

/** Keyed by item, so the draft resets without an effect when the item changes. */
function AnswerLab({ item }: { item: MatrixItem }) {
  const grid = item.grid ?? { rows: 1, cols: 1 };
  const [draft, setDraft] = useState(() => emptyDraft(grid));
  const raw = toRaw(draft, item);
  const parsed = raw === null ? null : parseAnswer(item.kind, raw);

  const setCell = (i: number, j: number, value: string) =>
    setDraft({
      ...draft,
      isUndefined: false,
      cells: draft.cells.map((row, r) => row.map((cell, c) => (r === i && c === j ? value : cell))),
    });

  const hasUndefinedButton =
    item.kind === 'matrix_or_undefined' || item.kind === 'dims_or_undefined';

  return (
    <>
      <Panel title="Try an answer">
        {(item.kind === 'matrix' || item.kind === 'matrix_or_undefined') && (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 6rem))` }}
          >
            {draft.cells.map((row, i) =>
              row.map((cell, j) => (
                <input
                  key={`${i}-${j}`}
                  aria-label={`row ${i + 1}, column ${j + 1}`}
                  className={`${FIELD} text-center font-matrix tabular-nums`}
                  value={cell}
                  onChange={(event) => setCell(i, j, event.target.value)}
                />
              )),
            )}
          </div>
        )}
        {(item.kind === 'scalar' || item.kind === 'cell') && (
          <input
            aria-label="answer"
            className={`${FIELD} max-w-40 font-matrix tabular-nums`}
            value={draft.text}
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
          />
        )}
        {(item.kind === 'dims' || item.kind === 'dims_or_undefined') && (
          <div className="flex items-center gap-2">
            <input
              aria-label="rows"
              className={`${FIELD} max-w-20 text-center`}
              value={draft.rows}
              onChange={(event) =>
                setDraft({ ...draft, isUndefined: false, rows: event.target.value })
              }
            />
            <span>×</span>
            <input
              aria-label="columns"
              className={`${FIELD} max-w-20 text-center`}
              value={draft.cols}
              onChange={(event) =>
                setDraft({ ...draft, isUndefined: false, cols: event.target.value })
              }
            />
          </div>
        )}
        {item.options && (
          <div className="flex flex-wrap gap-2">
            {item.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={BUTTON}
                aria-pressed={draft.choice === option.id}
                onClick={() => setDraft({ ...draft, choice: option.id })}
              >
                {th.choices[option.labelKey]}
                {draft.choice === option.id && ' ✓'}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {hasUndefinedButton && (
            <button
              type="button"
              className={BUTTON}
              aria-pressed={draft.isUndefined}
              onClick={() => setDraft({ ...draft, isUndefined: !draft.isUndefined })}
            >
              undefined{draft.isUndefined && ' ✓'}
            </button>
          )}
          <button
            type="button"
            className={BUTTON}
            onClick={() => setDraft(draftFrom(item.correct, grid))}
          >
            Fill correct
          </button>
        </div>
        <ClassificationView item={item} parsed={parsed} />
      </Panel>

      <Panel title={`Diagnostics (${item.diagnostics.length})`}>
        {item.diagnostics.length === 0 && <p>None on this item.</p>}
        <ul className="flex flex-col gap-3">
          {item.diagnostics.map((diagnostic) => {
            const scene = sceneFor(diagnostic.id, { kind: item.kind, variant: diagnostic.variant });
            return (
              <li
                key={`${diagnostic.id}:${diagnostic.variant ?? ''}`}
                className="flex flex-col gap-1 border-t border-neutral-200 pt-3 first:border-0 first:pt-0 dark:border-neutral-800"
              >
                <p className="font-medium break-words">
                  {diagnostic.id}
                  {diagnostic.variant && ` / ${diagnostic.variant}`}
                </p>
                <p className="font-matrix tabular-nums break-words">
                  {answerText(diagnostic.answer)}
                </p>
                <p className="text-sm">
                  scene: {scene.template}
                  {scene.mode && ` (${scene.mode})`}
                  {scene.fallback && ` → ${scene.fallback}`}
                </p>
                <button
                  type="button"
                  className={`${BUTTON} self-start`}
                  onClick={() => setDraft(draftFrom(diagnostic.answer, grid))}
                >
                  Fill this answer
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

function ItemView({ result }: { result: Extract<Generated, { ok: true }> }) {
  const { item, tries, requestedLevel, valid, regenerates } = result;
  const steps = workedSteps(item);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Item">
        <p className="text-lg font-medium">
          {fillTokens(th.prompts[item.prompt.key], item.prompt.params)}
        </p>
        {shownMatrices(item.data).map(({ label, value }) => (
          <MatrixText key={label} label={label} value={value} />
        ))}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
          <dt>kind</dt>
          <dd>{item.kind}</dd>
          {item.grid && (
            <>
              <dt>grid</dt>
              <dd>
                {item.grid.rows}×{item.grid.cols}
              </dd>
            </>
          )}
          <dt>level</dt>
          <dd>
            L{item.ref.difficulty}
            {item.ref.difficulty !== requestedLevel &&
              ` (probeLevel moved it from L${requestedLevel})`}
          </dd>
          <dt>draws</dt>
          <dd>{tries}</dd>
          <dt>validate</dt>
          <dd>{valid.ok ? 'pass' : `fail: rule ${valid.failure.rule}, ${valid.failure.detail}`}</dd>
          <dt>regenerate</dt>
          <dd>{regenerates ? 'identical' : 'DIFFERENT'}</dd>
        </dl>
        <pre className="overflow-x-auto rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-900">
          {JSON.stringify(item.ref)}
        </pre>
      </Panel>

      <Panel title="Answer key">
        <p className="font-matrix tabular-nums break-words" data-testid="correct">
          {answerText(item.correct)}
        </p>
        {item.correct.kind === 'matrix' && <MatrixText value={item.correct.value} />}
      </Panel>

      <AnswerLab key={JSON.stringify(item.ref)} item={item} />

      <Panel title={`Worked steps (${steps.length})`}>
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li key={index} className="min-w-0">
              <p className="text-sm">{fillTokens(th.worked[step.labelKey], step.params)}</p>
              <Formula latex={step.latex} />
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

export function EngineLab() {
  const [skill, setSkill] = useState<SkillId>('mult');
  const [level, setLevel] = useState<Level>(1);
  const [targetKey, setTargetKey] = useState('');
  const [seedText, setSeedText] = useState('1');

  const targets = useMemo(() => targetsFor(skill), [skill]);
  const target = targets.find((choice) => choice.key === targetKey);
  const seed = Number(seedText);
  const seedIsValid = seedText.trim() !== '' && Number.isSafeInteger(seed) && seed >= 0;

  const result = useMemo(
    () => (seedIsValid ? run(skill, level, target, seed) : null),
    [skill, level, target, seed, seedIsValid],
  );

  const changeSkill = (next: SkillId) => {
    setSkill(next);
    setTargetKey('');
    setLevel((current) =>
      current > skillById(next).maxLevel ? skillById(next).maxLevel : current,
    );
  };

  const targetLevels = target ? probeLevels(skill, target.id, target.variant) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Engine playground</h1>

      <Panel title="Request">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            Skill
            <select
              className={FIELD}
              value={skill}
              onChange={(event) => changeSkill(event.target.value as SkillId)}
            >
              {SKILLS.map(({ id, nameTh }) => (
                <option key={id} value={id}>
                  {id} · {nameTh}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Level
            <select
              className={FIELD}
              value={level}
              onChange={(event) => setLevel(Number(event.target.value) as Level)}
            >
              {levelsOf(skill).map((option) => (
                <option key={option} value={option}>
                  L{option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Target
            <select
              className={FIELD}
              value={targetKey}
              onChange={(event) => setTargetKey(event.target.value)}
            >
              <option value="">none</option>
              {targets.map(({ key }) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Seed
            <div className="flex gap-2">
              <input
                className={`${FIELD} min-w-0 font-matrix tabular-nums`}
                value={seedText}
                onChange={(event) => setSeedText(event.target.value)}
              />
              <button
                type="button"
                className={BUTTON}
                aria-label="next seed"
                disabled={!seedIsValid}
                onClick={() => setSeedText(String(seed + 1))}
              >
                +1
              </button>
            </div>
          </label>
        </div>
        {targetLevels && (
          <p className="text-sm">
            Table §4.1 allows: {targetLevels.map((l) => `L${l}`).join(', ')}
          </p>
        )}
      </Panel>

      {!seedIsValid && <p role="alert">Seed must be a non-negative integer.</p>}
      {result && !result.ok && (
        <p role="alert" className="font-medium text-red-700 dark:text-red-400">
          {result.message}
        </p>
      )}
      {result?.ok && <ItemView result={result} />}
    </main>
  );
}

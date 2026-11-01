'use client';

import { LazyMotion, domAnimation } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LazyScene } from '@/components/scenes/LazyScene';
import type { SceneView } from '@/components/scenes/playerState';
import { SceneStage } from '@/components/scenes/SceneStage';
import { BeatClockContext } from '@/components/scenes/svg';
import { Rational } from '@/lib/core/rational';
import type { Level, Matrix } from '@/lib/core/types';
import {
  conceptScene,
  exampleSeed,
  introScene,
  revealScene,
  sceneDurationMs,
  sceneLimitMs,
  type SceneSpec,
} from '@/lib/topics/matrix/scenes';
import { SCENE_COMBOS, caughtExample } from '@/lib/topics/matrix/scenes/catalog';
import { cellLocatorScene } from '@/lib/topics/matrix/scenes/cellLocator';
import { dimensionScene } from '@/lib/topics/matrix/scenes/dimensionMatch';
import { gridScene } from '@/lib/topics/matrix/scenes/gridTransform';
import { inverseScene } from '@/lib/topics/matrix/scenes/inverseRecipe';
import { rowColDotScene } from '@/lib/topics/matrix/scenes/rowColDot';
import { sarrusScene } from '@/lib/topics/matrix/scenes/sarrus';
import { transposeScene } from '@/lib/topics/matrix/scenes/transposeFlip';
import type {
  AnyScene,
  DimensionOp,
  GridMode,
  InverseVariant,
  RowColVariant,
  SarrusVariant,
  TemplateId,
} from '@/lib/topics/matrix/scenes/types';
import { generate } from '@/lib/topics/matrix/generators';
import { CATALOG } from '@/lib/topics/matrix/misconceptions';
import { det2, matrix } from '@/lib/topics/matrix/ops';
import { SKILLS, levelsOf, type SkillId } from '@/lib/topics/matrix/skills';

// Labels here are English on purpose: this page is a developer tool. Student copy comes from th.ts.

const FIELD =
  'h-11 w-full rounded-md border border-neutral-400 bg-transparent px-3 dark:border-neutral-600';
const BUTTON =
  'min-h-11 rounded-md border border-neutral-400 px-3 font-medium hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800';

type Kind = 'caught' | 'concept' | 'intro' | 'reveal' | 'custom';
type CustomTemplate = Exclude<TemplateId, 'worked_solution' | 'cell_by_cell' | 'det_sum'>;

export interface LabQuery {
  kind?: Kind;
  combo?: string;
  skill?: SkillId;
  level?: string;
  seed?: string;
  unit?: string;
  /** Hides the controls so the player fills the screen, for recording video. */
  present?: string;
  /** Lists every caption and how it renders. */
  captions?: string;
  /** Every beat of the scene side by side, as still frames. */
  board?: string;
}

interface LabState {
  kind: Kind;
  combo: number;
  skill: SkillId;
  level: Level;
  seed: number;
  unit: 1 | 2 | 3 | 4 | 5;
  template: CustomTemplate;
  gridMode: GridMode;
  dimensionOp: DimensionOp;
  rowColVariant: '' | RowColVariant;
  inverseVariant: '' | InverseVariant;
  sarrusVariant: '' | SarrusVariant;
  k: number;
  n: number;
  first: string;
  second: string;
}

function parseMatrix(text: string): Matrix {
  const rows = text.split(';').map((row) =>
    row
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((cell) => Rational.parse(cell)),
  );
  return matrix(rows);
}

function parseDims(text: string): { rows: number; cols: number } {
  const [rows, cols] = text.split(/[x×\s]+/).map(Number);
  return { rows, cols };
}

function comboLabel(index: number): string {
  const { id, variant, level, skill } = SCENE_COMBOS[index];
  return `${id.slice(0, 3)} ${variant ?? ''} · ${skill} L${level}`;
}

function build(state: LabState): SceneSpec {
  switch (state.kind) {
    case 'caught': {
      const caught = caughtExample(SCENE_COMBOS[state.combo], state.seed);
      if (!caught) throw new Error('This seed has no such diagnostic.');
      return caught.spec;
    }
    case 'concept':
      return conceptScene(state.skill, { seed: exampleSeed(state.seed, 0), level: state.level });
    case 'intro':
      return introScene(state.unit);
    case 'reveal':
      return revealScene(
        generate({ skill: state.skill, difficulty: state.level, seed: state.seed }),
      );
    case 'custom':
      break;
  }
  const purpose =
    state.rowColVariant || state.inverseVariant || state.sarrusVariant ? 'remediate' : 'concept';
  switch (state.template) {
    case 'cell_locator':
      return cellLocatorScene({
        A: parseMatrix(state.first),
        i: state.k,
        j: state.n,
        showSwapped: true,
        purpose,
      });
    case 'transpose_flip':
      return transposeScene({ A: parseMatrix(state.first), purpose });
    case 'sarrus':
      return sarrusScene({
        A: parseMatrix(state.first),
        variant: state.sarrusVariant || undefined,
        purpose,
      });
    case 'row_col_dot':
      return rowColDotScene({
        left: parseMatrix(state.first),
        right: parseMatrix(state.second),
        variant: state.rowColVariant || undefined,
        purpose,
      });
    case 'dimension_match':
      return dimensionScene({
        op: state.dimensionOp,
        first: parseDims(state.first),
        second: state.dimensionOp === 'single' ? undefined : parseDims(state.second),
        purpose,
      });
    case 'inverse_recipe':
      return inverseScene({
        A: parseMatrix(state.first),
        variant: state.inverseVariant || undefined,
        withCheck: true,
        purpose,
      });
    case 'grid_transform': {
      const M = parseMatrix(state.first);
      if (state.gridMode === 'compose') {
        return gridScene({ mode: 'compose', M, N: parseMatrix(state.second), purpose });
      }
      if (state.gridMode === 'scale_k') {
        return gridScene({
          mode: 'scale_k',
          M,
          k: state.k,
          d: det2(M).n / det2(M).d,
          n: state.n,
          purpose,
        });
      }
      return gridScene({ mode: state.gridMode, M, purpose });
    }
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function SceneLab({ query }: { query: LabQuery }) {
  const [state, setState] = useState<LabState>({
    kind: query.kind ?? 'caught',
    combo: Number(query.combo ?? 0),
    skill: query.skill ?? 'mult',
    level: (Number(query.level ?? 1) as Level) || 1,
    seed: Number(query.seed ?? 1),
    unit: (Number(query.unit ?? 1) as LabState['unit']) || 1,
    template: 'row_col_dot',
    gridMode: 'det_area',
    dimensionOp: 'mult',
    rowColVariant: '',
    inverseVariant: '',
    sarrusVariant: '',
    k: 2,
    n: 2,
    first: '2 1; 3 4',
    second: '1 5; 2 0',
  });
  const [still, setStill] = useState(false);
  const [views, setViews] = useState<SceneView[]>([]);
  const [run, setRun] = useState(0);

  const set = <K extends keyof LabState>(key: K, value: LabState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const result = useMemo(() => {
    try {
      return { spec: build(state) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [state]);

  if (query.captions) return <CaptionCheck />;

  const player = result.spec && (
    <LazyScene
      key={`${JSON.stringify(result.spec)}:${run}:${still}`}
      spec={result.spec}
      title={`${result.spec.template} · ${result.spec.purpose}`}
      forceStill={still || undefined}
      onView={(view) => setViews((current) => [view, ...current].slice(0, 5))}
      onDone={() => setRun((current) => current + 1)}
    />
  );

  if (query.present) return <main className="h-dvh">{player}</main>;
  if (query.board && result.spec) return <Storyboard spec={result.spec} />;

  const scene = result.spec as AnyScene | undefined;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <h1 className="text-2xl font-bold">Scene gallery</h1>
        <Field label="Source">
          <select
            className={FIELD}
            value={state.kind}
            onChange={(event) => set('kind', event.target.value as Kind)}
          >
            <option value="caught">Caught misconception (compare)</option>
            <option value="concept">Concept scene of a skill</option>
            <option value="intro">Unit intro</option>
            <option value="reveal">Worked solution of an item</option>
            <option value="custom">Custom numbers</option>
          </select>
        </Field>

        {state.kind === 'caught' && (
          <Field label={`Misconception (${CATALOG.length} ★, ${SCENE_COMBOS.length} combinations)`}>
            <select
              className={FIELD}
              value={state.combo}
              onChange={(event) => set('combo', Number(event.target.value))}
            >
              {SCENE_COMBOS.map((_, index) => (
                <option key={index} value={index}>
                  {comboLabel(index)}
                </option>
              ))}
            </select>
          </Field>
        )}

        {(state.kind === 'concept' || state.kind === 'reveal') && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Skill">
              <select
                className={FIELD}
                value={state.skill}
                onChange={(event) => set('skill', event.target.value as SkillId)}
              >
                {SKILLS.map(({ id }) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Level">
              <select
                className={FIELD}
                value={state.level}
                onChange={(event) => set('level', Number(event.target.value) as Level)}
              >
                {levelsOf(state.skill).map((level) => (
                  <option key={level} value={level}>
                    L{level}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {state.kind === 'intro' && (
          <Field label="Unit">
            <select
              className={FIELD}
              value={state.unit}
              onChange={(event) => set('unit', Number(event.target.value) as LabState['unit'])}
            >
              {[1, 2, 3, 4, 5].map((unit) => (
                <option key={unit} value={unit}>
                  Unit {unit}
                </option>
              ))}
            </select>
          </Field>
        )}

        {state.kind !== 'intro' && state.kind !== 'custom' && (
          <Field label="Seed">
            <div className="flex gap-2">
              <input
                className={FIELD}
                inputMode="numeric"
                value={state.seed}
                onChange={(event) => set('seed', Number(event.target.value) || 0)}
              />
              <button type="button" className={BUTTON} onClick={() => set('seed', state.seed + 1)}>
                Next
              </button>
            </div>
          </Field>
        )}

        {state.kind === 'custom' && <CustomFields state={state} set={set} />}

        <label className="flex min-h-11 items-center gap-2 font-medium">
          <input
            type="checkbox"
            className="size-5"
            checked={still}
            onChange={(event) => setStill(event.target.checked)}
          />
          Still frames (as with prefers-reduced-motion)
        </label>

        {result.error && <p className="font-medium text-warn">{result.error}</p>}

        {scene && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
            <dt className="font-semibold">Length</dt>
            <dd>
              {(sceneDurationMs(scene) / 1000).toFixed(1)} s of {sceneLimitMs(scene.purpose) / 1000}{' '}
              s, {scene.beats.length} beats
            </dd>
            <dt className="font-semibold">Beats</dt>
            <dd>{scene.beats.join(' · ')}</dd>
            <dt className="font-semibold">Last views</dt>
            <dd>
              {views.length === 0
                ? 'none yet'
                : views
                    .map(
                      (view) =>
                        `${view.beatsSeen}/${view.beatsTotal}${view.skipped ? ' skipped' : ''}, ${view.replays} replays, ${(view.durationMs / 1000).toFixed(1)} s`,
                    )
                    .join(' | ')}
            </dd>
          </dl>
        )}

        {result.spec && (
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">
              SceneSpec
            </summary>
            <pre className="overflow-x-auto rounded-md bg-sunken p-3 text-xs">
              {JSON.stringify(result.spec, null, 2)}
            </pre>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="h-[640px] w-[360px] max-w-full overflow-hidden rounded-xl border border-line bg-canvas">
          {player}
        </div>
        <a className={`${BUTTON} flex items-center justify-center`} href="/dev/scenes?captions=1">
          Check every caption
        </a>
      </section>
    </main>
  );
}

/** Reviews a whole scene at a glance. Each frame is what prefers-reduced-motion shows for that beat. */
function Storyboard({ spec }: { spec: SceneSpec }) {
  const scene = spec as AnyScene;
  return (
    <LazyMotion features={domAnimation}>
      <main className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 p-3">
        {scene.beats.map((beat) => (
          <figure key={beat} className="flex flex-col gap-1 rounded-lg border border-line p-2">
            <div className="h-[320px]">
              <BeatClockContext.Provider value={{ ms: 0, still: true }}>
                <SceneStage spec={spec} beat={beat} />
              </BeatClockContext.Provider>
            </div>
            <figcaption className="text-center text-sm font-medium">
              {scene.flagged === beat ? '⚑ ' : ''}
              {scene.captions[beat] ?? beat}
            </figcaption>
          </figure>
        ))}
      </main>
    </LazyMotion>
  );
}

function CustomFields({
  state,
  set,
}: {
  state: LabState;
  set<K extends keyof LabState>(key: K, value: LabState[K]): void;
}) {
  return (
    <>
      <Field label="Template">
        <select
          className={FIELD}
          value={state.template}
          onChange={(event) => set('template', event.target.value as CustomTemplate)}
        >
          <option value="row_col_dot">row_col_dot</option>
          <option value="dimension_match">dimension_match</option>
          <option value="grid_transform">grid_transform</option>
          <option value="inverse_recipe">inverse_recipe</option>
          <option value="cell_locator">cell_locator</option>
          <option value="transpose_flip">transpose_flip</option>
          <option value="sarrus">sarrus</option>
        </select>
      </Field>
      {state.template === 'cell_locator' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Row i">
            <input
              className={FIELD}
              value={state.k}
              onChange={(event) => set('k', Number(event.target.value) || 1)}
            />
          </Field>
          <Field label="Column j">
            <input
              className={FIELD}
              value={state.n}
              onChange={(event) => set('n', Number(event.target.value) || 1)}
            />
          </Field>
        </div>
      )}
      {state.template === 'sarrus' && (
        <Field label="Compare">
          <select
            className={FIELD}
            value={state.sarrusVariant}
            onChange={(event) =>
              set('sarrusVariant', event.target.value as LabState['sarrusVariant'])
            }
          >
            <option value="">none</option>
            <option value="ADD">ADD (2×2)</option>
            <option value="REVERSE">REVERSE (2×2)</option>
            <option value="PAIRS_ROW">PAIRS_ROW (2×2)</option>
            <option value="PAIRS_COL">PAIRS_COL (2×2)</option>
            <option value="ALL_PLUS">ALL_PLUS (3×3)</option>
            <option value="NO_ALT_SIGN">NO_ALT_SIGN (3×3)</option>
            <option value="TWO_DIAG">TWO_DIAG (3×3)</option>
          </select>
        </Field>
      )}
      {state.template === 'row_col_dot' && (
        <Field label="Compare">
          <select
            className={FIELD}
            value={state.rowColVariant}
            onChange={(event) =>
              set('rowColVariant', event.target.value as LabState['rowColVariant'])
            }
          >
            <option value="">none</option>
            <option value="elementwise">elementwise</option>
            <option value="row_row">row_row</option>
            <option value="col_col">col_col</option>
            <option value="reversed">reversed</option>
          </select>
        </Field>
      )}
      {state.template === 'inverse_recipe' && (
        <Field label="Compare">
          <select
            className={FIELD}
            value={state.inverseVariant}
            onChange={(event) =>
              set('inverseVariant', event.target.value as LabState['inverseVariant'])
            }
          >
            <option value="">none</option>
            <option value="NO_SWAP">NO_SWAP</option>
            <option value="NO_NEGATE">NO_NEGATE</option>
            <option value="NO_DIVIDE">NO_DIVIDE</option>
            <option value="TIMES_DET">TIMES_DET</option>
            <option value="TRANSPOSED">TRANSPOSED</option>
            <option value="RECIPROCAL">RECIPROCAL</option>
          </select>
        </Field>
      )}
      {state.template === 'dimension_match' && (
        <Field label="Mode">
          <select
            className={FIELD}
            value={state.dimensionOp}
            onChange={(event) => set('dimensionOp', event.target.value as DimensionOp)}
          >
            <option value="mult">mult</option>
            <option value="add">add</option>
            <option value="single">single</option>
          </select>
        </Field>
      )}
      {state.template === 'grid_transform' && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Mode">
            <select
              className={FIELD}
              value={state.gridMode}
              onChange={(event) => set('gridMode', event.target.value as GridMode)}
            >
              <option value="det_area">det_area</option>
              <option value="det_zero">det_zero</option>
              <option value="scale_k">scale_k</option>
              <option value="compose">compose</option>
              <option value="undo">undo</option>
            </select>
          </Field>
          <Field label="k">
            <input
              className={FIELD}
              value={state.k}
              onChange={(event) => set('k', Number(event.target.value) || 2)}
            />
          </Field>
          <Field label="n">
            <input
              className={FIELD}
              value={state.n}
              onChange={(event) => set('n', Number(event.target.value) || 2)}
            />
          </Field>
        </div>
      )}
      <Field
        label={
          state.template === 'dimension_match'
            ? 'First dims, as 2x3'
            : 'First matrix: rows split by ;'
        }
      >
        <input
          className={FIELD}
          value={state.first}
          onChange={(event) => set('first', event.target.value)}
        />
      </Field>
      <Field label={state.template === 'dimension_match' ? 'Second dims' : 'Second matrix'}>
        <input
          className={FIELD}
          value={state.second}
          onChange={(event) => set('second', event.target.value)}
        />
      </Field>
    </>
  );
}

const CHECK_SEEDS = Array.from({ length: 25 }, (_, index) => index * 7919 + 1);

/** Every distinct caption, in the player's own text style and at its 360px width. */
function collectCaptions(): Map<string, string> {
  const found = new Map<string, string>();
  const add = (source: string, spec: SceneSpec) => {
    for (const caption of Object.values((spec as AnyScene).captions)) {
      if (caption && !found.has(caption)) found.set(caption, source);
    }
  };
  for (let index = 0; index < SCENE_COMBOS.length; index += 1) {
    for (const seed of CHECK_SEEDS) {
      const caught = caughtExample(SCENE_COMBOS[index], seed);
      if (caught) add(comboLabel(index), caught.spec);
    }
  }
  for (const { id } of SKILLS) {
    for (const level of levelsOf(id)) {
      for (const seed of CHECK_SEEDS) {
        add(`concept ${id} L${level}`, conceptScene(id, { seed, level }));
      }
    }
  }
  for (const unit of [1, 2, 3, 4, 5] as const) add(`intro ${unit}`, introScene(unit));
  for (const k of [-3, -2, -1, 2, 3, 4, 5]) {
    for (const d of [-6, 6]) {
      add(
        `scale_k ${k} ${d}`,
        gridScene({
          mode: 'scale_k',
          M: matrix([
            [Math.abs(d), 1],
            [0, 1],
          ]),
          k,
          d,
          n: 3,
          purpose: 'remediate',
        }),
      );
    }
  }
  return found;
}

const CAPTION_WIDTH = 328;

function CaptionCheck() {
  const [rows, setRows] = useState<
    { text: string; source: string; width: number; lines: number }[]
  >([]);
  const list = useRef<HTMLDivElement>(null);
  const captions = useMemo(() => [...collectCaptions()], []);

  useEffect(() => {
    void document.fonts.ready.then(() => {
      const nodes = list.current?.querySelectorAll<HTMLElement>('[data-caption]') ?? [];
      setRows(
        [...nodes].map((node, index) => ({
          text: captions[index][0],
          source: captions[index][1],
          width: Math.ceil(node.getBoundingClientRect().width),
          lines: new Set([...node.getClientRects()].map((rect) => Math.round(rect.top))).size,
        })),
      );
    });
  }, [captions]);

  const sorted = [...rows].sort((a, b) => b.width - a.width);
  const failing = rows.filter(({ lines }) => lines > 1).length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
      <h1 className="text-2xl font-bold">Captions at {CAPTION_WIDTH}px</h1>
      <p
        data-caption-summary={`${rows.length}:${failing}:${sorted[0]?.width ?? 0}`}
        className="font-medium"
      >
        {rows.length} captions, {failing} over one line, widest {sorted[0]?.width ?? 0}px
      </p>
      {/* Measured off to the side at the player's own width and style. */}
      <div
        ref={list}
        aria-hidden="true"
        className="invisible absolute"
        style={{ width: CAPTION_WIDTH }}
      >
        {captions.map(([text]) => (
          <div key={text}>
            <span data-caption className="font-medium">
              {text}
            </span>
          </div>
        ))}
      </div>
      <table className="text-sm">
        <thead>
          <tr className="text-left">
            <th className="pr-3">Width</th>
            <th className="pr-3">Lines</th>
            <th className="pr-3">Caption</th>
            <th>First seen in</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ text, source, width, lines }) => (
            <tr key={text} className={lines > 1 ? 'text-warn' : ''}>
              <td className="pr-3 font-matrix tabular-nums">{width}</td>
              <td className="pr-3 font-matrix tabular-nums">{lines}</td>
              <td className="pr-3">{text}</td>
              <td className="text-muted">{source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

import { th } from '@/lib/content/th';
import { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import { signed } from '../format';
import { det2, identity, inv2, mul, scalar } from '../ops';
import type {
  GridBeat,
  GridBounds,
  GridMode,
  GridTransformParams,
  ScenePurpose,
  SceneSpecOf,
} from './types';

const BEAT_MS: Record<GridBeat, number> = {
  unit: 1500,
  apply: 3000,
  area: 2500,
  flip: 2000,
  cant_undo: 2500,
  scale: 3000,
  cube: 2500,
  first: 3000,
  second: 3000,
  differ: 2500,
  undo: 3000,
  back: 2000,
};

const SUPERSCRIPT = { 2: '²', 3: '³' } as const;

/** k² for copy, with the brackets a negative base needs: (−2)², never −2². */
export function powerText(k: number, exponent: 2 | 3): string {
  const base = k < 0 ? `(${signed(k)})` : String(k);
  return `${base}${SUPERSCRIPT[exponent]}`;
}

/** The smallest box of whole grid units holding every corner of every frame. */
function boundsOf(frames: Partial<Record<GridBeat, Matrix[]>>): GridBounds {
  const xs: Rational[] = [Rational.ZERO, Rational.ONE];
  const ys: Rational[] = [Rational.ZERO, Rational.ONE];
  for (const panels of Object.values(frames)) {
    for (const [[a, b], [c, d]] of panels) {
      xs.push(a, b, a.add(b));
      ys.push(c, d, c.add(d));
    }
  }
  const low = (values: Rational[]) => Math.min(...values.map((v) => Math.floor(v.n / v.d)));
  const high = (values: Rational[]) => Math.max(...values.map((v) => Math.ceil(v.n / v.d)));
  return { minX: low(xs), maxX: high(xs), minY: low(ys), maxY: high(ys) };
}

interface Base {
  purpose: ScenePurpose;
  /** The numbers are a 2×2 stand-in for what the item asked, so the first caption says so. */
  example?: boolean;
  studentAnswer?: Answer;
  captions?: Partial<Record<GridBeat, string>>;
}

export type GridInput = Base &
  (
    | { mode: 'det_area' | 'det_zero' | 'undo'; M: Matrix }
    | { mode: 'scale_k'; M: Matrix; k: number; d: number; n: number }
    | { mode: 'compose'; M: Matrix; N: Matrix }
  );

type Plan = {
  beats: GridBeat[];
  frames: Partial<Record<GridBeat, Matrix[]>>;
  shown: GridTransformParams['shown'];
  captions: Partial<Record<GridBeat, string>>;
  panels?: string[];
};

const IDENTITY = identity(2);

function planFor(input: GridInput): Plan {
  const copy = th.scenes.grid;
  const name = 'A';
  switch (input.mode) {
    case 'det_area': {
      const { M } = input;
      const det = det2(M);
      return {
        beats: ['unit', 'apply', 'area', ...(det.sign() < 0 ? (['flip'] as const) : [])],
        frames: { unit: [IDENTITY], apply: [M], area: [M], flip: [M] },
        shown: [{ label: name, value: M, from: 'unit' }],
        captions: {
          unit: copy.unit,
          apply: fillTokens(copy.apply, { name }),
          area: fillTokens(copy.area, { absDet: det.abs().toString() }),
          flip: copy.flip,
        },
      };
    }
    case 'det_zero': {
      const { M } = input;
      return {
        beats: ['unit', 'apply', 'cant_undo'],
        frames: { unit: [IDENTITY], apply: [M], cant_undo: [M] },
        shown: [{ label: name, value: M, from: 'unit' }],
        captions: {
          unit: copy.unit,
          apply: fillTokens(copy.flatten, { name }),
          cant_undo: copy.cant_undo,
        },
      };
    }
    case 'scale_k': {
      const { M, k, d, n } = input;
      const scaled = scalar(Rational.of(k), M);
      const absK = String(Math.abs(k));
      const scaleCopy = k > 0 ? copy.scale_up : k === -1 ? copy.scale_minus_one : copy.scale_flip;
      return {
        beats: ['unit', 'apply', 'scale', 'area', ...(n === 3 ? (['cube'] as const) : [])],
        frames: { unit: [IDENTITY], apply: [M], scale: [scaled], area: [scaled], cube: [scaled] },
        shown: [
          { label: name, value: M, from: 'unit' },
          { label: `${k === -1 ? '−' : signed(k)}${name}`, value: scaled, from: 'scale' },
        ],
        captions: {
          unit: copy.unit,
          apply: fillTokens(copy.scale_start, { d: signed(d), absD: String(Math.abs(d)) }),
          scale: fillTokens(scaleCopy, { absK }),
          area: fillTokens(copy.scale_area, { kPow2: powerText(k, 2), factor: String(k * k) }),
          cube: fillTokens(copy.scale_cube, { kPow3: powerText(k, 3) }),
        },
      };
    }
    case 'compose': {
      const { M, N } = input;
      const names = { M: 'A', N: 'B' };
      return {
        beats: ['unit', 'first', 'second', 'differ'],
        frames: {
          unit: [IDENTITY, IDENTITY],
          first: [N, M],
          second: [mul(M, N), mul(N, M)],
          differ: [mul(M, N), mul(N, M)],
        },
        shown: [
          { label: names.M, value: M, from: 'unit' },
          { label: names.N, value: N, from: 'unit' },
        ],
        panels: [`${names.M}${names.N}`, `${names.N}${names.M}`],
        captions: {
          unit: copy.compose_setup,
          first: fillTokens(copy.compose_first, names),
          second: fillTokens(copy.compose_second, names),
          differ: copy.differ,
        },
      };
    }
    case 'undo': {
      const { M } = input;
      return {
        beats: ['unit', 'apply', 'undo', 'back'],
        frames: { unit: [IDENTITY], apply: [M], undo: [IDENTITY], back: [IDENTITY] },
        shown: [
          { label: name, value: M, from: 'unit' },
          { label: `${name}⁻¹`, value: inv2(M), from: 'undo' },
        ],
        captions: {
          unit: copy.unit,
          apply: fillTokens(copy.undo_apply, { name }),
          undo: fillTokens(copy.undo, { name }),
          back: copy.back,
        },
      };
    }
  }
}

/** SCENES §3.3. Each frame comes exact from the engine; drawing it in between is the template's job. */
export function gridScene(input: GridInput): SceneSpecOf<'grid_transform'> {
  const { beats, frames, shown, captions, panels } = planFor(input);
  const mode: GridMode = input.mode;
  return {
    template: 'grid_transform',
    params: {
      mode,
      shown,
      ...(panels && { panels }),
      frames,
      bounds: boundsOf(frames),
    },
    beats,
    captions: {
      ...captions,
      ...(input.example && { unit: th.scenes.grid.example }),
      ...input.captions,
    },
    beatMs: BEAT_MS,
    ...(input.studentAnswer && { compare: { studentAnswer: input.studentAnswer } }),
    purpose: input.purpose,
  };
}

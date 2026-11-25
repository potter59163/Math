import * as m from 'motion/react-m';
import { useContext, useId, type ReactNode } from 'react';
import { HAND, HandText, Reveal, WIDTH, fitted, useReveal } from '@/components/clip/kit';
import { th } from '@/lib/content/th';
import { Rational } from '@/lib/core/rational';
import { Surd, surdText } from '@/lib/core/surd';
import { BeatClockContext, SvgBracket, SvgNumber, SvgText, numberWidth, useTween } from '../svg';

// What the vector clips draw with, on top of the clip kit: one oblique view of 3D space for every clip,
// arrows that are drawn as a pen would and slide without turning, and exact numbers with √ in them.
// Positions here are floats, which is all they are: where to draw. Every number written comes from
// the spec, exact.

/** For drawing only. */
export const toNum = (value: Rational): number => value.n / value.d;
export const toNums = (v: readonly Rational[]): number[] => v.map(toNum);

/**
 * The one oblique projection of every 3D clip (VECTORS §5), as the textbook draws it: y to the right,
 * z up, and x towards the reader, down and to the left at a little over half length.
 */
export const OBLIQUE = { x: [-0.5, 0.38], y: [1, 0], z: [0, -1] } as const;

export interface XY {
  x: number;
  y: number;
}

/** A point of 2D or 3D space on the flat page, before scaling. y and z point up. */
export function project(p: readonly number[]): XY {
  if (p.length === 2) return { x: p[0], y: -p[1] };
  const [x, y, z] = p;
  return {
    x: x * OBLIQUE.x[0] + y * OBLIQUE.y[0] + z * OBLIQUE.z[0],
    y: x * OBLIQUE.x[1] + y * OBLIQUE.y[1] + z * OBLIQUE.z[1],
  };
}

export interface Frame {
  at(p: readonly number[]): XY;
  /** Pixels per unit. */
  unit: number;
}

/** Scales and centers these points to fill the box, the same in every direction. */
export function frameFor(
  points: readonly (readonly number[])[],
  box: { x: number; y: number; width: number; height: number },
  { maxUnit = 60 }: { maxUnit?: number } = {},
): Frame {
  const flat = points.map(project);
  const xs = flat.map((p) => p.x);
  const ys = flat.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const unit = Math.min(
    maxUnit,
    box.width / Math.max(maxX - minX, 1e-6),
    box.height / Math.max(maxY - minY, 1e-6),
  );
  const offsetX = box.x + (box.width - (maxX - minX) * unit) / 2 - minX * unit;
  const offsetY = box.y + (box.height - (maxY - minY) * unit) / 2 - minY * unit;
  return {
    unit,
    at: (p) => {
      const { x, y } = project(p);
      return { x: offsetX + x * unit, y: offsetY + y * unit };
    },
  };
}

export type ArrowTone = 'row' | 'col' | 'third' | 'good' | 'warn' | 'muted';

export const STROKE: Record<ArrowTone, string> = {
  row: 'stroke-cta',
  col: 'stroke-brand',
  third: 'stroke-flame',
  good: 'stroke-good',
  warn: 'stroke-warn',
  muted: 'stroke-edge',
};

export const FILL: Record<ArrowTone, string> = {
  row: 'fill-cta',
  col: 'fill-brand',
  third: 'fill-flame',
  good: 'fill-good',
  warn: 'fill-warn',
  muted: 'fill-muted',
};

const HEAD = 9;

/**
 * An arrow drawn from its tail. `from` is where it is, and moving it slides it without turning, which
 * is all that moving a vector ever does.
 */
export function Arrow({
  from,
  to,
  tone,
  show,
  start = 0,
  length = 0.3,
  width = 3,
  dashed,
  label,
  labelSide = 1,
}: {
  from: XY;
  to: XY;
  tone: ArrowTone;
  show: boolean;
  start?: number;
  length?: number;
  width?: number;
  dashed?: boolean;
  label?: ReactNode;
  /** Which side of the arrow the label sits on. */
  labelSide?: 1 | -1;
}) {
  const reveal = useReveal();
  const tween = useTween();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const size = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / size, dy / size];
  const head = Math.min(HEAD, size * 0.45);
  const shaftEnd = { x: dx - ux * head * 0.7, y: dy - uy * head * 0.7 };
  const left = { x: dx - ux * head - uy * head * 0.55, y: dy - uy * head + ux * head * 0.55 };
  const right = { x: dx - ux * head + uy * head * 0.55, y: dy - uy * head - ux * head * 0.55 };
  const normal = { x: -uy * labelSide, y: ux * labelSide };
  return (
    <m.g initial={false} animate={{ x: from.x, y: from.y }} transition={tween(start, length)}>
      <m.path
        d={`M0 0 L${shaftEnd.x} ${shaftEnd.y}`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }}
        transition={reveal(show, start, 0.25)}
        fill="none"
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? '4 6' : undefined}
        className={STROKE[tone]}
      />
      <Reveal show={show} start={start + 0.2}>
        <path
          d={`M${dx} ${dy} L${left.x} ${left.y} L${right.x} ${right.y} Z`}
          className={`${FILL[tone]} ${STROKE[tone]}`}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        {label !== undefined && (
          <g transform={`translate(${dx / 2 + normal.x * 14} ${dy / 2 + normal.y * 14})`}>
            {label}
          </g>
        )}
      </Reveal>
    </m.g>
  );
}

/** A dot with its name, for points of a figure or of space. */
export function PointMark({
  at,
  label,
  show = true,
  dx = 0,
  dy = -14,
  tone = 'muted',
}: {
  at: XY;
  label?: string;
  show?: boolean;
  dx?: number;
  dy?: number;
  tone?: ArrowTone;
}) {
  return (
    <Reveal show={show}>
      <circle cx={at.x} cy={at.y} r={3.5} className={FILL[tone]} />
      {label && (
        <HandText x={at.x + dx} y={at.y + dy} size={16} className="fill-ink">
          {label}
        </HandText>
      )}
    </Reveal>
  );
}

/** The axes of the view, faint, with their names at the ends. */
export function Axes({
  frame,
  reach,
  show = true,
  dims,
}: {
  frame: Frame;
  /** How far each axis goes, both ways, in units. */
  reach: [number, number][];
  show?: boolean;
  dims: 2 | 3;
}) {
  const names = ['x', 'y', 'z'];
  const unitVec = (axis: number, t: number) =>
    Array.from({ length: dims }, (_, i) => (i === axis ? t : 0));
  return (
    <Reveal show={show}>
      {reach.slice(0, dims).map(([low, high], axis) => {
        const a = frame.at(unitVec(axis, low));
        const b = frame.at(unitVec(axis, high));
        return (
          <g key={axis}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              strokeWidth={1.5}
              strokeDasharray="2 5"
              strokeLinecap="round"
              className="stroke-edge"
            />
            <SvgText
              x={b.x + (axis === 0 ? -8 : 8)}
              y={b.y + (axis === 2 ? -8 : 6)}
              size={13}
              className={`${HAND} fill-muted`}
            >
              {names[axis]}
            </SvgText>
          </g>
        );
      })}
    </Reveal>
  );
}

/** Both ends of every axis, so that a frame fitted to them keeps the axes inside the picture. */
export function axisEnds(reach: readonly [number, number][]): number[][] {
  return reach.flatMap(([low, high], axis) =>
    [low, high].map((t) => reach.map((_, i) => (i === axis ? t : 0))),
  );
}

/** Dashed guides from a point down to the floor and across to the axes, as the textbook reads (x, y, z). */
export function Guides({
  frame,
  p,
  show = true,
}: {
  frame: Frame;
  p: readonly number[];
  show?: boolean;
}) {
  const lines: [readonly number[], readonly number[]][] =
    p.length === 2
      ? [
          [p, [p[0], 0]],
          [p, [0, p[1]]],
        ]
      : [
          [p, [p[0], p[1], 0]],
          [
            [p[0], p[1], 0],
            [p[0], 0, 0],
          ],
          [
            [p[0], p[1], 0],
            [0, p[1], 0],
          ],
        ];
  return (
    <Reveal show={show}>
      {lines.map(([a, b], i) => {
        const [from, to] = [frame.at(a), frame.at(b)];
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            strokeWidth={1}
            strokeDasharray="2 4"
            className="stroke-edge"
          />
        );
      })}
    </Reveal>
  );
}

/** How far the axes should reach to hold these points, with a little to spare. */
export function reachOf(points: readonly (readonly number[])[], dims: 2 | 3): [number, number][] {
  return Array.from({ length: dims }, (_, axis) => {
    const values = points.map((p) => p[axis] ?? 0);
    return [Math.min(0, ...values) - 0.6, Math.max(0, ...values) + 0.9];
  });
}

const SURD_FONT = 'font-matrix tabular-nums';

/** Close enough for layout, as numberWidth is. */
export function surdWidth(value: Surd, size: number): number {
  if (value.isRational()) return numberWidth(value.toRational(), size);
  const { n, d } = value.coeff;
  const top = `${Math.abs(n) === 1 ? '' : Math.abs(n)}√${value.radicand}`;
  const main = (d === 1 ? top.length : Math.max(top.length, String(d).length) * 0.85) * size * 0.6;
  return main + (n < 0 ? size * 0.6 : 0) + size * 0.2;
}

/** a√b written as on paper: the radicand under a bar, and a stacked fraction when there is one. */
export function SvgSurd({
  value,
  x = 0,
  y = 0,
  size = 18,
  className = 'fill-ink',
}: {
  value: Surd;
  x?: number;
  y?: number;
  size?: number;
  className?: string;
}) {
  if (value.isRational()) {
    return <SvgNumber value={value.toRational()} x={x} y={y} size={size} className={className} />;
  }
  const { n, d } = value.coeff;
  const coeff = Math.abs(n) === 1 ? '' : String(Math.abs(n));
  const small = d === 1 ? size : size * 0.8;
  const radicand = String(value.radicand);
  const coeffW = coeff.length * small * 0.6;
  const rootW = small * 0.62;
  const radW = radicand.length * small * 0.6;
  const topW = coeffW + rootW + radW;
  const sign = n < 0;
  const shift = sign ? size * 0.35 : 0;
  const left = x + shift - topW / 2;
  const topY = d === 1 ? y : y - small * 0.62;
  const piece = (text: string, at: number, w: number) => (
    <SvgText x={at + w / 2} y={topY} size={small} className={SURD_FONT}>
      {text}
    </SvgText>
  );
  return (
    <g className={className}>
      {sign && (
        <SvgText x={left - size * 0.4} y={y} size={size} className={SURD_FONT}>
          −
        </SvgText>
      )}
      {coeff && piece(coeff, left, coeffW)}
      {piece('√', left + coeffW, rootW)}
      {piece(radicand, left + coeffW + rootW, radW)}
      <line
        x1={left + coeffW + rootW * 0.85}
        x2={left + topW + 1}
        y1={topY - small * 0.55}
        y2={topY - small * 0.55}
        strokeWidth={1.2}
        className="stroke-current"
      />
      {d !== 1 && (
        <>
          <line
            x1={left - 1}
            x2={left + topW + 1}
            y1={y}
            y2={y}
            strokeWidth={1.2}
            className="stroke-current"
          />
          <SvgText x={left + topW / 2} y={y + small * 0.62} size={small} className={SURD_FONT}>
            {d}
          </SvgText>
        </>
      )}
    </g>
  );
}

export type Entry = Rational | Surd | string;

const asSurd = (entry: Entry): Surd | null =>
  entry instanceof Surd ? entry : entry instanceof Rational ? Surd.rational(entry) : null;

/** One component of a column vector: an exact number, or a letter such as the unknown k. */
export function EntryText({
  entry,
  x,
  y,
  size,
  className = 'fill-ink',
}: {
  entry: Entry;
  x: number;
  y: number;
  size: number;
  className?: string;
}) {
  const surd = asSurd(entry);
  if (surd) return <SvgSurd value={surd} x={x} y={y} size={size} className={className} />;
  return (
    <SvgText x={x} y={y} size={size} className={`${HAND} ${className}`}>
      {entry as string}
    </SvgText>
  );
}

export function entryWidth(entry: Entry, size: number): number {
  const surd = asSurd(entry);
  return surd ? surdWidth(surd, size) : String(entry).length * size * 0.6;
}

export interface ColumnBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rowHeight: number;
  cy(i: number): number;
  cx: number;
}

/** Where a column vector of these entries sits, centered on x, its top at y. */
export function columnBox(
  entries: readonly Entry[],
  x: number,
  y: number,
  size: number,
): ColumnBox {
  const fractions = entries.some((e) => {
    const surd = asSurd(e);
    return surd !== null && surd.coeff.d !== 1;
  });
  const rowHeight = size * (fractions ? 2.2 : 1.6);
  const width = Math.max(size * 1.4, ...entries.map((e) => entryWidth(e, size))) + 18;
  return {
    x: x - width / 2,
    y,
    width,
    height: entries.length * rowHeight + 6,
    rowHeight,
    cx: x,
    cy: (i) => y + 3 + rowHeight * (i + 0.5),
  };
}

/** A column vector in brackets, as the textbook writes one: a row lit when the beat is about it. */
export function Column({
  entries,
  box,
  size,
  label,
  lit,
  tone = 'row',
  faint,
  entryClass,
  show = true,
  start,
}: {
  entries: readonly Entry[];
  box: ColumnBox;
  size: number;
  label?: ReactNode;
  /** The component the beat is about. */
  lit?: number;
  tone?: 'row' | 'col' | 'warn' | 'good';
  /** Fades the other components. */
  faint?: boolean;
  entryClass?(i: number): string;
  show?: boolean;
  start?: number;
}) {
  const tween = useTween();
  const band = {
    row: 'fill-cta/20 stroke-cta',
    col: 'fill-brand/20 stroke-brand',
    warn: 'fill-warn/20 stroke-warn',
    good: 'fill-good/20 stroke-good',
  }[tone];
  return (
    <Reveal show={show} start={start}>
      {label !== undefined && <g transform={`translate(${box.cx} ${box.y - 15})`}>{label}</g>}
      <m.rect
        x={box.x + 5}
        width={box.width - 10}
        height={box.rowHeight - 4}
        rx={7}
        strokeWidth={2}
        initial={false}
        animate={{
          y: box.cy(lit ?? 0) - box.rowHeight / 2 + 2,
          opacity: lit === undefined ? 0 : 1,
        }}
        transition={tween(0, 0.25)}
        className={band}
      />
      <g transform={`translate(${box.x} ${box.y})`}>
        <SvgBracket width={box.width} height={box.height} />
      </g>
      {entries.map((entry, i) => (
        <m.g
          key={i}
          initial={false}
          animate={{ opacity: faint && lit !== undefined && lit !== i ? 0.35 : 1 }}
          transition={tween(0, 0.2)}
        >
          <EntryText
            entry={entry}
            x={box.cx}
            y={box.cy(i)}
            size={size}
            className={entryClass?.(i) ?? 'fill-ink'}
          />
        </m.g>
      ))}
    </Reveal>
  );
}

/** A vector's name with the arrow over it, as in the textbook: AB, u, 2MN. */
export function VecName({
  name,
  x = 0,
  y = 0,
  size = 18,
  className = 'fill-ink',
  arrow = true,
}: {
  name: string;
  x?: number;
  y?: number;
  size?: number;
  className?: string;
  arrow?: boolean;
}) {
  const letters = name.replace(/^[−\-]?[\d½/]*/, '');
  const prefix = name.slice(0, name.length - letters.length);
  const letterW = letters.length * size * 0.58;
  const prefixW = prefix.length * size * 0.55;
  const total = letterW + prefixW;
  const left = x - total / 2;
  const top = y - size * 0.72;
  const strokeClass = className.replace('fill-', 'stroke-');
  return (
    <g>
      {prefix && (
        <SvgText x={left + prefixW / 2} y={y} size={size} className={`${HAND} ${className}`}>
          {prefix}
        </SvgText>
      )}
      <SvgText
        x={left + prefixW + letterW / 2}
        y={y}
        size={size}
        className={`${HAND} ${className}`}
      >
        {letters}
      </SvgText>
      {arrow && (
        <g className={strokeClass} strokeWidth={1.4} strokeLinecap="round" fill="none">
          <path d={`M${left + prefixW + 1} ${top} H${left + total - 1}`} />
          <path
            d={`M${left + total - 5} ${top - 3} L${left + total - 1} ${top} L${left + total - 5} ${top + 3}`}
          />
        </g>
      )}
    </g>
  );
}

/** A line of working, as big as fits the board. */
export function WorkLine({
  text,
  y,
  show,
  start,
  size = 24,
  className = 'fill-ink',
  pop,
  x = WIDTH / 2,
  width,
}: {
  text: string;
  y: number;
  show: boolean;
  start?: number;
  size?: number;
  className?: string;
  pop?: boolean;
  x?: number;
  width?: number;
}) {
  return (
    <Reveal show={show} start={start} pop={pop}>
      <HandText x={x} y={y} size={fitted(text, size, width)} className={className}>
        {text}
      </HandText>
    </Reveal>
  );
}

/** What a student answered against what is right, for answers too long for the clip kit's Verdict. */
export function SideBySide({
  mine,
  right,
  show,
  y,
  start = 0.05,
}: {
  mine: string;
  right: string;
  show: boolean;
  y: number;
  start?: number;
}) {
  const size = (text: string) => fitted(text, 34, 150);
  return (
    <>
      <Reveal show={show} start={start}>
        <HandText x={88} y={y} size={16} className="fill-muted">
          {th.clip.mine}
        </HandText>
        <HandText x={88} y={y + 34} size={size(mine)} className="fill-warn">
          {mine}
        </HandText>
      </Reveal>
      <Reveal show={show} start={start + 0.25} pop>
        <HandText x={252} y={y} size={16} className="fill-muted">
          {th.clip.right}
        </HandText>
        <HandText x={252} y={y + 34} size={size(right)} className="fill-good">
          {right}
        </HandText>
      </Reveal>
    </>
  );
}

/** An arc for the angle between two directions at a corner, with its name. */
export function AngleArc({
  at,
  from,
  to,
  radius = 26,
  show,
  start,
  label,
  tone = 'muted',
}: {
  at: XY;
  /** Directions, as points the two sides pass through. */
  from: XY;
  to: XY;
  radius?: number;
  show: boolean;
  start?: number;
  label?: string;
  tone?: ArrowTone;
}) {
  const reveal = useReveal();
  const a1 = Math.atan2(from.y - at.y, from.x - at.x);
  let a2 = Math.atan2(to.y - at.y, to.x - at.x);
  let sweep = a2 - a1;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  a2 = a1 + sweep;
  const p1 = { x: at.x + radius * Math.cos(a1), y: at.y + radius * Math.sin(a1) };
  const p2 = { x: at.x + radius * Math.cos(a2), y: at.y + radius * Math.sin(a2) };
  const mid = a1 + sweep / 2;
  const square = Math.abs(Math.abs(sweep) - Math.PI / 2) < 0.02;
  const corner = (k: number) => ({
    x: at.x + k * (Math.cos(a1) + Math.cos(a2)) * radius * 0.5,
    y: at.y + k * (Math.sin(a1) + Math.sin(a2)) * radius * 0.5,
  });
  const path = square
    ? `M${at.x + Math.cos(a1) * radius * 0.5} ${at.y + Math.sin(a1) * radius * 0.5} L${corner(1).x} ${corner(1).y} L${at.x + Math.cos(a2) * radius * 0.5} ${at.y + Math.sin(a2) * radius * 0.5}`
    : `M${p1.x} ${p1.y} A${radius} ${radius} 0 0 ${sweep > 0 ? 1 : 0} ${p2.x} ${p2.y}`;
  return (
    <>
      <m.path
        d={path}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }}
        transition={reveal(show, start, 0.2)}
        fill="none"
        strokeWidth={2}
        className={STROKE[tone]}
      />
      {label && (
        <Reveal show={show} start={(start ?? 0) + 0.15}>
          <HandText
            x={at.x + (radius + 16) * Math.cos(mid)}
            y={at.y + (radius + 16) * Math.sin(mid)}
            size={15}
            className={FILL[tone]}
          >
            {label}
          </HandText>
        </Reveal>
      )}
    </>
  );
}

/** Draws an arrowhead marker, for paths with a head of their own. */
export function useMarker(): string {
  return useId().replace(/\W/g, '');
}

/** Centers of pieces laid side by side with these widths, the whole row centered on `middle`. */
export function centersOf(widths: readonly number[], gap: number, middle = WIDTH / 2): number[] {
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, widths.length - 1);
  return widths.map(
    (width, i) =>
      middle - total / 2 + widths.slice(0, i).reduce((a, b) => a + b + gap, 0) + width / 2,
  );
}

/** True while a still frame is wanted (prefers-reduced-motion). */
export function useStill(): boolean {
  return useContext(BeatClockContext).still;
}

export { surdText };

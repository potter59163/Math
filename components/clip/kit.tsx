'use client';

import * as m from 'motion/react-m';
import {
  createContext,
  useContext,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  BeatClockContext,
  Fade,
  SvgBracket,
  SvgNumber,
  SvgText,
  numberWidth,
  useTween,
} from '@/components/scenes/svg';
import { th } from '@/lib/content/th';
import type { Matrix } from '@/lib/core/types';

// The pieces every clip is drawn with: one board, one sheet of the notebook, and numbers that travel from
// where they come from to where they are used. Yellow is always a row and blue is always a column.

export const WIDTH = 340;
export const HEIGHT = 430;
export const STAGE_ASPECT = WIDTH / HEIGHT;

export const BRACKET = 6;
/** In seconds, and quick, so that two steps of a story never show at once. */
const LEAVE = 0.12;
const POP_FROM = 0.6;
/** Where in a flight the number has come in and starts to go, as fractions of the flight. */
const FLIGHT_FADES = [0, 0.06, 0.94, 1];

export const HAND = 'font-hand';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Box extends Rect {
  cell: number;
  rowHeight: number;
  cx(j: number): number;
  cy(i: number): number;
}

export function boxAt(
  x: number,
  y: number,
  rows: number,
  cols: number,
  cell: number,
  rowHeight = cell,
): Box {
  return {
    x,
    y,
    width: cols * cell + 2 * BRACKET,
    height: rows * rowHeight + 4,
    cell,
    rowHeight,
    cx: (j) => x + BRACKET + cell * (j + 0.5),
    cy: (i) => y + 2 + rowHeight * (i + 0.5),
  };
}

/** Inside the brackets, so that a highlight never covers them. */
export const rowRect = (box: Box, i: number): Rect => ({
  x: box.x + BRACKET - 1,
  y: box.cy(i) - box.rowHeight / 2 + 2,
  width: box.width - 2 * BRACKET + 2,
  height: box.rowHeight - 4,
});

export const colRect = (box: Box, j: number): Rect => ({
  x: box.cx(j) - box.cell / 2 + 2,
  y: box.y + 3,
  width: box.cell - 4,
  height: box.height - 6,
});

export const cellRect = (box: Box, i: number, j: number): Rect => ({
  x: box.cx(j) - box.cell / 2 + 2,
  y: box.cy(i) - box.rowHeight / 2 + 2,
  width: box.cell - 4,
  height: box.rowHeight - 4,
});

/** What a clip does when a student taps an answer on the stage. */
export const ClipActionsContext = createContext<{ right(): void; wrong(): void }>({
  right() {},
  wrong() {},
});

export function Stage({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full">
      {children}
    </svg>
  );
}

/** Comes in when its moment in the beat arrives, and leaves at once. */
export function useReveal() {
  const tween = useTween();
  const { still } = useContext(BeatClockContext);
  return (show: boolean, start?: number, length = 0.15) =>
    show ? tween(start, length) : { duration: still ? 0 : LEAVE };
}

export function Reveal({
  show,
  start = 0,
  length,
  pop = false,
  children,
}: {
  show: boolean;
  start?: number;
  length?: number;
  /** For the number the step has been leading up to. */
  pop?: boolean;
  children: ReactNode;
}) {
  const reveal = useReveal();
  const { ms, still } = useContext(BeatClockContext);
  const hidden = { opacity: 0, scale: pop ? POP_FROM : 1 };
  const bounce = {
    type: 'spring',
    stiffness: 380,
    damping: 14,
    delay: (ms * start) / 1000,
  } as const;
  return (
    <m.g
      initial={hidden}
      animate={show ? { opacity: 1, scale: 1 } : hidden}
      transition={{
        ...reveal(show, start, length),
        ...(pop && show && !still ? { scale: bounce } : {}),
      }}
    >
      {children}
    </m.g>
  );
}

export function HandText({
  x,
  y,
  size,
  className = 'fill-ink',
  anchor,
  children,
}: {
  x: number;
  y: number;
  size: number;
  className?: string;
  anchor?: 'start' | 'middle' | 'end';
  children: ReactNode;
}) {
  return (
    <SvgText x={x} y={y} size={size} anchor={anchor} className={`${HAND} ${className}`}>
      {children}
    </SvgText>
  );
}

/** A size at which this line of hand writing fits the width. */
export const fitted = (text: string, largest: number, width = WIDTH - 24) =>
  Math.min(largest, width / (text.length * 0.56));

export type Tone = 'row' | 'col' | 'warn' | 'good';

const BAND_CLASS: Record<Tone, string> = {
  row: 'fill-cta/20 stroke-cta',
  col: 'fill-brand/20 stroke-brand',
  warn: 'fill-warn/20 stroke-warn',
  good: 'fill-good/20 stroke-good',
};

export function Band({
  box,
  tone,
  show,
  start,
}: {
  box: Rect;
  tone: Tone;
  show: boolean;
  start?: number;
}) {
  const reveal = useReveal();
  return (
    <m.rect
      {...box}
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={reveal(show, start)}
      rx={8}
      strokeWidth={2}
      className={BAND_CLASS[tone]}
    />
  );
}

const RING_CLASS: Record<Tone, string> = {
  row: 'stroke-cta',
  col: 'stroke-brand',
  warn: 'stroke-warn',
  good: 'stroke-good',
};

/** A loop drawn by hand, which overshoots where it began. */
export function Ring({
  cx,
  cy,
  r,
  show,
  tone = 'warn',
  start,
}: {
  cx: number;
  cy: number;
  r: number;
  show: boolean;
  tone?: Tone;
  start?: number;
}) {
  const reveal = useReveal();
  const path = `M${cx - r * 0.2} ${cy - r} C${cx + r * 1.15} ${cy - r * 1.2} ${cx + r * 1.2} ${cy + r * 1.1} ${cx} ${cy + r} C${cx - r * 1.25} ${cy + r * 1.05} ${cx - r * 1.2} ${cy - r * 1.15} ${cx + r * 0.3} ${cy - r * 1.1}`;
  return (
    <m.path
      d={path}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }}
      transition={reveal(show, start, 0.14)}
      fill="none"
      strokeWidth={2.5}
      strokeLinecap="round"
      className={RING_CLASS[tone]}
    />
  );
}

/** A number on its way from one place to another, unseen until it sets off and gone once it lands. */
export function Fly({
  from,
  to,
  show,
  start,
  length,
  shrinkTo = 1,
  children,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  show: boolean;
  start?: number;
  length?: number;
  shrinkTo?: number;
  children: ReactNode;
}) {
  const tween = useTween();
  const timing = tween(start, length);
  return (
    <m.g
      initial={false}
      animate={
        show
          ? {
              x: [from.x, to.x],
              y: [from.y, to.y],
              scale: [1, shrinkTo],
              opacity: [0, 1, 1, 0],
            }
          : { x: from.x, y: from.y, scale: 1, opacity: 0 }
      }
      transition={
        show ? { ...timing, opacity: { ...timing, times: FLIGHT_FADES } } : { duration: 0 }
      }
    >
      {children}
    </m.g>
  );
}

const CHIP_FILL = { row: 'fill-marker', col: 'fill-brand-soft' } as const;

/** A number in its box, so that it can be read over board and paper alike while it travels. */
export function Chip({
  width,
  height,
  size,
  tone,
  ink = 'fill-ink',
  children,
}: {
  width: number;
  height: number;
  size: number;
  tone: keyof typeof CHIP_FILL;
  ink?: string;
  children: ReactNode;
}) {
  return (
    <g className="paper">
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={height > 36 ? 8 : 6}
        className={CHIP_FILL[tone]}
      />
      <HandText x={0} y={0} size={size} className={ink}>
        {children}
      </HandText>
    </g>
  );
}

/** A size at which every number of a matrix fits its cell. */
export function matrixFont(value: Matrix, cell: number, rowHeight = cell): number {
  const largest = Math.min(cell * 0.56, rowHeight * 0.56, 28);
  const widest = Math.max(...value.flat().map((number) => numberWidth(number, largest)));
  return widest > cell - 6 ? (largest * (cell - 6)) / widest : largest;
}

export function BoardMatrix({
  value,
  box,
  label,
  labelClass = 'fill-muted',
  opacity,
  hidden,
  numberClass = 'fill-ink',
  start,
}: {
  value: Matrix;
  box: Box;
  label?: string;
  labelClass?: string;
  /** Faint for what the beat is not about. */
  opacity?(i: number, j: number): number;
  hidden?(i: number, j: number): boolean;
  numberClass?: string;
  start?: number;
}) {
  const font = matrixFont(value, box.cell, box.rowHeight);
  return (
    <g>
      {label && (
        <HandText x={box.x + box.width / 2} y={box.y - 15} size={15} className={labelClass}>
          {label}
        </HandText>
      )}
      <g transform={`translate(${box.x} ${box.y})`}>
        <SvgBracket width={box.width} height={box.height} />
      </g>
      {value.map((cells, i) =>
        cells.map((number, j) => (
          <Fade
            key={`${i}:${j}`}
            show={!hidden?.(i, j)}
            to={opacity?.(i, j) ?? 1}
            start={start}
            length={0.1}
          >
            <SvgNumber
              value={number}
              x={box.cx(j)}
              y={box.cy(i)}
              size={font}
              className={numberClass}
            />
          </Fade>
        )),
      )}
    </g>
  );
}

/** What a student answered against what is right, big enough to be the first thing they see. */
export function Verdict({
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
  const size = Math.min(52, 104 / (Math.max(mine.length, right.length) * 0.6));
  return (
    <>
      <Reveal show={show} start={start}>
        <HandText x={92} y={y} size={18} className="fill-muted">
          {th.clip.mine}
        </HandText>
        <HandText x={92} y={y + 52} size={size} className="fill-brand">
          {mine}
        </HandText>
      </Reveal>
      <Reveal show={show} start={start + 0.2}>
        <path
          d={`M150 ${y + 55} C165 ${y + 45} 180 ${y + 45} 196 ${y + 53} M186 ${y + 43} L197 ${y + 53} L184 ${y + 61}`}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-muted"
        />
        <HandText x={250} y={y} size={18} className="fill-muted">
          {th.clip.right}
        </HandText>
      </Reveal>
      <Reveal show={show} start={start + 0.28} pop>
        <HandText x={250} y={y + 52} size={size} className="fill-cta">
          {right}
        </HandText>
      </Reveal>
    </>
  );
}

/** A line of the wrong working, in red and struck through. */
export function Struck({
  text,
  y,
  show,
  start,
  size = 34,
}: {
  text: string;
  y: number;
  show: boolean;
  start?: number;
  size?: number;
}) {
  const font = fitted(text, size);
  const half = (text.length * font * 0.5) / 2;
  return (
    <Reveal show={show} start={start}>
      <HandText x={WIDTH / 2} y={y} size={font} className="fill-warn">
        {text}
      </HandText>
      <line
        x1={WIDTH / 2 - half}
        x2={WIDTH / 2 + half}
        y1={y + 2}
        y2={y - 2}
        strokeWidth={2.5}
        strokeLinecap="round"
        className="stroke-warn"
      />
    </Reveal>
  );
}

/** A rule worth remembering, as big as the board allows: yellow, then a joining word, then blue. */
export function BigWords({
  left,
  middle,
  right,
  y,
  show,
  start = 0.05,
}: {
  left: string;
  middle: string;
  right: string;
  y: number;
  show: boolean;
  start?: number;
}) {
  return (
    <>
      <Reveal show={show} start={start} pop>
        <HandText x={82} y={y} size={54} className="fill-cta font-semibold">
          {left}
        </HandText>
      </Reveal>
      <Reveal show={show} start={start + 0.08}>
        <HandText x={170} y={y + 6} size={20} className="fill-muted">
          {middle}
        </HandText>
      </Reveal>
      <Reveal show={show} start={start + 0.17} pop>
        <HandText x={258} y={y} size={54} className="fill-brand font-semibold">
          {right}
        </HandText>
      </Reveal>
    </>
  );
}

/** A tick drawn by hand. */
export function Tick({
  x,
  y,
  size = 22,
  show,
  start,
}: {
  x: number;
  y: number;
  size?: number;
  show: boolean;
  start?: number;
}) {
  const reveal = useReveal();
  return (
    <m.path
      d={`M${x - size} ${y} L${x - size * 0.25} ${y + size * 0.7} L${x + size} ${y - size * 0.8}`}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }}
      transition={reveal(show, start, 0.2)}
      fill="none"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stroke-good"
    />
  );
}

/** A cross drawn by hand. */
export function Cross({
  x,
  y,
  size = 18,
  show,
  start,
}: {
  x: number;
  y: number;
  size?: number;
  show: boolean;
  start?: number;
}) {
  const reveal = useReveal();
  return (
    <m.path
      d={`M${x - size} ${y - size} L${x + size} ${y + size} M${x + size} ${y - size} L${x - size} ${y + size}`}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }}
      transition={reveal(show, start, 0.2)}
      fill="none"
      strokeWidth={4}
      strokeLinecap="round"
      className="stroke-warn"
    />
  );
}

const PAPER_X = 14;
const PAPER_WIDTH = 312;

/** The saw-toothed bottom edge is what makes a sheet of paper read as a bill. */
function paperPath(y: number, height: number) {
  const teeth = 18;
  const tooth = PAPER_WIDTH / teeth;
  const edge = Array.from(
    { length: teeth },
    (_, k) =>
      `L${PAPER_X + PAPER_WIDTH - tooth * (k + 0.5)} ${y + height + 5} L${PAPER_X + PAPER_WIDTH - tooth * (k + 1)} ${y + height}`,
  ).join(' ');
  return `M${PAPER_X} ${y} H${PAPER_X + PAPER_WIDTH} V${y + height} ${edge} Z`;
}

/** A sheet of the notebook that slides up from under the board. */
export function Paper({
  show,
  y,
  height,
  children,
}: {
  show: boolean;
  y: number;
  height: number;
  children: ReactNode;
}) {
  const { still } = useContext(BeatClockContext);
  return (
    <m.g
      initial={false}
      animate={{ y: show ? 0 : HEIGHT }}
      transition={still ? { duration: 0 } : { type: 'spring', stiffness: 130, damping: 20 }}
    >
      <g className="paper">
        <path
          d={paperPath(y, height)}
          transform={`rotate(-0.7 ${WIDTH / 2} ${y + height / 2})`}
          className="fill-surface"
          style={{ filter: 'drop-shadow(0 6px 10px rgb(0 0 0 / 0.4))' }}
        />
        {children}
      </g>
    </m.g>
  );
}

function pressable(onTap: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      onTap();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onTap();
      }
    },
  };
}

/** A part of a matrix that can be tapped, marked by a dashed edge that breathes. */
export function TapArea({
  hit,
  edge,
  label,
  tone,
  onTap,
}: {
  /** The whole row, column or cell can be tapped. */
  hit: Rect;
  edge: Rect;
  label: string;
  tone: 'row' | 'col';
  onTap(): void;
}) {
  const { still } = useContext(BeatClockContext);
  return (
    <g {...pressable(onTap)} aria-label={label} className="group cursor-pointer outline-none">
      <rect {...hit} fill="transparent" />
      <m.rect
        {...edge}
        rx={8}
        fill="none"
        strokeWidth={2}
        strokeDasharray="5 5"
        animate={still ? { opacity: 1 } : { opacity: [0.4, 1, 0.4] }}
        transition={still ? { duration: 0 } : { duration: 1.4, repeat: Infinity }}
        className={`${tone === 'row' ? 'stroke-cta' : 'stroke-brand'} group-focus-visible:stroke-ink group-focus-visible:[stroke-dasharray:none]`}
      />
    </g>
  );
}

/** Red for a moment over what a student just tapped, when it was not the right one. */
export function WrongFlash({ box, n }: { box: Rect; n: number }) {
  const { still } = useContext(BeatClockContext);
  return (
    <m.rect
      key={n}
      {...box}
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 0 }}
      transition={{ duration: still ? 0 : 0.7 }}
      rx={8}
      className="pointer-events-none fill-warn/50"
    />
  );
}

const LONG_OPTION = 12;
const OPTION_GAP = 8;
const OPTION_HEIGHT = 60;
const STACKED_HEIGHT = 44;

/** Answers to a quick question: cards to tap, side by side if short and one above the other if long. */
export function Choices({
  options,
  right,
  y,
}: {
  options: readonly string[];
  right: number;
  /** Where the cards start. */
  y: number;
}) {
  const actions = useContext(ClipActionsContext);
  const [flash, setFlash] = useState<{ box: Rect; n: number } | null>(null);
  const stacked = options.some((option) => option.length > LONG_OPTION);
  const count = options.length;
  const width = stacked ? WIDTH - 40 : (WIDTH - 40 - OPTION_GAP * (count - 1)) / count;
  const height = stacked ? STACKED_HEIGHT : OPTION_HEIGHT;
  const boxOf = (index: number): Rect =>
    stacked
      ? { x: 20, y: y + index * (height + OPTION_GAP), width, height }
      : { x: 20 + index * (width + OPTION_GAP), y, width, height };

  return (
    <g>
      {options.map((option, index) => {
        const box = boxOf(index);
        const pick = () => {
          if (index === right) {
            setFlash(null);
            actions.right();
            return;
          }
          setFlash((last) => ({ box, n: (last?.n ?? 0) + 1 }));
          actions.wrong();
        };
        return (
          <g
            key={option}
            {...pressable(pick)}
            aria-label={option}
            className="paper group cursor-pointer outline-none"
          >
            <rect
              {...box}
              rx={10}
              strokeWidth={2}
              className="fill-surface stroke-transparent group-focus-visible:stroke-brand"
              style={{ filter: 'drop-shadow(0 3px 5px rgb(0 0 0 / 0.35))' }}
            />
            <HandText
              x={box.x + box.width / 2}
              y={box.y + box.height / 2}
              size={fitted(option, stacked ? 22 : 28, box.width - 12)}
            >
              {option}
            </HandText>
          </g>
        );
      })}
      {flash && <WrongFlash box={flash.box} n={flash.n} />}
    </g>
  );
}

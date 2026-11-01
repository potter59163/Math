'use client';

import * as m from 'motion/react-m';
import { useContext, useState, type ReactNode } from 'react';
import { BeatClockContext, Fade, SvgBracket, SvgText, useTween } from '@/components/scenes/svg';
import { th } from '@/lib/content/th';
import type { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import { rationalText } from '@/lib/topics/matrix/format';
import {
  RECEIPT_BEATS,
  WAITING_BEATS,
  type ReceiptBeat,
  type ReceiptClip,
} from '@/lib/topics/matrix/scenes/receiptClip';
import { ClipPlayer } from './ClipPlayer';

// One board for the whole clip: A × B = the student's own answer, marked in red as it goes. Below it the
// receipt slides in on a sheet of the notebook, and the numbers fly down from the row and the column, so a
// student can see where each one came from. Yellow is always the row, and blue is always the column.

const WIDTH = 340;
const HEIGHT = 430;
const TOP = 30;
const BRACKET = 6;
const OPERATOR = 16;
const MAX_CELL = 44;

const PAPER_X = 14;
const PAPER_WIDTH = 312;
const PAPER_Y = 136;
const ITEM_X = 34;
const QTY_X = 164;
const TIMES_X = 196;
const PRICE_X = 226;
const EQUALS_X = 258;
const AMOUNT_X = 292;

/** In seconds, and quick, so that two steps of the story never show at once. */
const LEAVE = 0.12;
const POP_FROM = 0.6;
/** Tap areas reach past the matrix on its outer sides, for phones so short that the drawing shrinks. */
const OUTSET = 12;
/** Where in a flight the number has come in and starts to go, as fractions of the flight. */
const FLIGHT_FADES = [0, 0.06, 0.94, 1];

const HAND = 'font-hand';

const copy = th.clip.receipt;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Box {
  x: number;
  width: number;
  height: number;
  cx(j: number): number;
  cy(i: number): number;
}

function layout({ left, right, product }: ReceiptClip) {
  const columns = left[0].length + right[0].length + product[0].length;
  const cell = Math.min(MAX_CELL, (WIDTH - 4 - 6 * BRACKET - 2 * OPERATOR) / columns);
  const boxAt = (x: number, rows: number, cols: number): Box => ({
    x,
    width: cols * cell + 2 * BRACKET,
    height: rows * cell + 4,
    cx: (j) => x + BRACKET + cell * (j + 0.5),
    cy: (i) => TOP + 2 + cell * (i + 0.5),
  });
  const total = columns * cell + 6 * BRACKET + 2 * OPERATOR;
  const a = boxAt((WIDTH - total) / 2, left.length, left[0].length);
  const b = boxAt(a.x + a.width + OPERATOR, right.length, right[0].length);
  const p = boxAt(b.x + b.width + OPERATOR, product.length, product[0].length);
  return { a, b, p, cell, font: cell * 0.56 };
}

/** Comes in when its moment in the beat arrives, and leaves at once. */
function useReveal() {
  const tween = useTween();
  const { still } = useContext(BeatClockContext);
  return (show: boolean, start?: number, length = 0.15) =>
    show ? tween(start, length) : { duration: still ? 0 : LEAVE };
}

function Reveal({
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

function HandText({
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

function Band({ box, tone, show }: { box: Rect; tone: 'row' | 'col'; show: boolean }) {
  const reveal = useReveal();
  return (
    <m.rect
      {...box}
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={reveal(show)}
      rx={8}
      strokeWidth={2}
      className={tone === 'row' ? 'fill-cta/20 stroke-cta' : 'fill-brand/20 stroke-brand'}
    />
  );
}

/** A loop drawn by hand, which overshoots where it began. */
function Ring({
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
  tone?: 'warn' | 'row';
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
      className={tone === 'warn' ? 'stroke-warn' : 'stroke-cta'}
    />
  );
}

/** A number on its way from one place to another, unseen until it sets off and gone once it lands. */
function Fly({
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

/** A number in its box, looking just as it does on the receipt, so that it can be seen on board and paper. */
function Chip({
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
  tone: 'fill-marker' | 'fill-brand-soft';
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
        className={tone}
      />
      <HandText x={0} y={0} size={size} className={ink}>
        {children}
      </HandText>
    </g>
  );
}

/** One cell of the student's answer. Once marked, their number moves up small and struck through. */
function AnswerCell({
  x,
  y,
  mine,
  right,
  font,
  marked,
  start,
}: {
  x: number;
  y: number;
  mine: Rational;
  right: Rational;
  font: number;
  marked: boolean;
  start?: number;
}) {
  const reveal = useReveal();
  const wrong = !mine.equals(right);
  const moved = marked && wrong;
  const transition = reveal(marked, start, 0.14);
  return (
    <>
      <m.g
        initial={false}
        animate={moved ? { x: x + 15, y: y - 14, scale: 0.58 } : { x, y, scale: 1 }}
        transition={transition}
      >
        <HandText x={0} y={0} size={font} className="fill-brand">
          {rationalText(mine)}
        </HandText>
        <m.line
          initial={false}
          animate={{ opacity: moved ? 1 : 0 }}
          transition={transition}
          x1={-font * 0.7}
          x2={font * 0.7}
          y1={2}
          y2={-2}
          strokeWidth={2.5}
          strokeLinecap="round"
          className="stroke-warn"
        />
      </m.g>
      {wrong && (
        <m.g
          initial={false}
          animate={{ opacity: marked ? 1 : 0, scale: marked ? 1 : 1.5, x: x - 3, y: y + 4 }}
          transition={transition}
        >
          <HandText x={0} y={0} size={font} className="fill-cta">
            {rationalText(right)}
          </HandText>
        </m.g>
      )}
    </>
  );
}

function TapArea({
  hit,
  edge,
  label,
  tone,
  onTap,
}: {
  /** The whole row or column can be tapped, right out to the brackets. */
  hit: Rect;
  edge: Rect;
  label: string;
  tone: 'row' | 'col';
  onTap(): void;
}) {
  const { still } = useContext(BeatClockContext);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      className="group cursor-pointer outline-none"
      onClick={(event) => {
        event.stopPropagation();
        onTap();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onTap();
        }
      }}
    >
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

/** The saw-toothed bottom edge is what makes a sheet of paper read as a receipt. */
function paperPath(height: number) {
  const teeth = 18;
  const tooth = PAPER_WIDTH / teeth;
  const edge = Array.from(
    { length: teeth },
    (_, k) =>
      `L${PAPER_X + PAPER_WIDTH - tooth * (k + 0.5)} ${PAPER_Y + height + 5} L${PAPER_X + PAPER_WIDTH - tooth * (k + 1)} ${PAPER_Y + height}`,
  ).join(' ');
  return `M${PAPER_X} ${PAPER_Y} H${PAPER_X + PAPER_WIDTH} V${PAPER_Y + height} ${edge} Z`;
}

interface StageProps {
  clip: ReceiptClip;
  beat: ReceiptBeat;
  onRight(): void;
  onWrong(hint: string): void;
}

export function ReceiptStage({ clip, beat, onRight, onWrong }: StageProps) {
  const { left, right, product, student, focus, tryCell, lines, total, theirLine } = clip;
  const { still } = useContext(BeatClockContext);
  const [flash, setFlash] = useState<{ box: Rect; n: number } | null>(null);

  const at = RECEIPT_BEATS.indexOf(beat);
  const reached = (name: ReceiptBeat) => at >= RECEIPT_BEATS.indexOf(name);
  const during = (from: ReceiptBeat, until: ReceiptBeat) => reached(from) && !reached(until);

  const { a, b, p, cell, font } = layout(clip);
  const [row, col] = focus;
  const [tryRow, tryCol] = tryCell;

  const rowHit = (i: number): Rect => ({
    x: a.x,
    y: a.cy(i) - cell / 2 - (i === 0 ? OUTSET : 0),
    width: a.width,
    height: cell + (i === 0 || i === left.length - 1 ? OUTSET : 0),
  });
  const colHit = (j: number): Rect => ({
    x: b.cx(j) - cell / 2 - (j === 0 ? BRACKET : 0),
    y: TOP - OUTSET,
    width: cell + (j === 0 || j === right[0].length - 1 ? BRACKET : 0),
    height: b.height + 2 * OUTSET,
  });
  /** Inside the brackets, so that a highlight never covers them. */
  const rowEdge = (i: number): Rect => ({
    x: a.x + BRACKET - 1,
    y: a.cy(i) - cell / 2 + 2,
    width: a.width - 2 * BRACKET + 2,
    height: cell - 4,
  });
  const colEdge = (j: number): Rect => ({
    x: b.cx(j) - cell / 2 + 2,
    y: TOP + 3,
    width: cell - 4,
    height: b.height - 6,
  });

  const leftOpacity = (i: number, j: number) => {
    if (beat === 'did') return i === row && j === col ? 1 : 0.3;
    if (during('quantities', 'try_row')) return i === row ? 1 : 0.3;
    if (during('try_col', 'end')) return i === tryRow ? 1 : 0.3;
    return 1;
  };
  const rightOpacity = (i: number, j: number) => {
    if (beat === 'did') return i === row && j === col ? 1 : 0.3;
    if (during('prices', 'try_row')) return j === col ? 1 : 0.3;
    if (during('try_done', 'end')) return j === tryCol ? 1 : 0.3;
    return 1;
  };

  const lineHeight = lines.length === 2 ? 56 : 44;
  const lineY = (k: number) => PAPER_Y + 92 + k * lineHeight;
  const ruleY = lineY(lines.length - 1) + 28;
  const totalY = ruleY + 32;
  const paperHeight = totalY + 30 - PAPER_Y;
  const paperIn = during('quantities', 'rule');

  const tap = (kind: 'row' | 'col', index: number) => {
    if (index === (kind === 'row' ? tryRow : tryCol)) {
      setFlash(null);
      onRight();
      return;
    }
    setFlash((last) => ({
      box: kind === 'row' ? rowEdge(index) : colEdge(index),
      n: (last?.n ?? 0) + 1,
    }));
    onWrong(kind === 'row' ? clip.hints.row : clip.hints.col);
  };

  const chip = (template: string, known: boolean, value: number) =>
    fillTokens(template, { n: known ? String(value + 1) : '?' });

  const ruleShown = beat === 'rule' || beat === 'end';
  const worked = beat === 'try_done';

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full">
      {/* ---- A × B = what the student answered */}
      <Band box={rowEdge(row)} tone="row" show={during('quantities', 'try_row')} />
      <Band box={colEdge(col)} tone="col" show={during('prices', 'try_row')} />
      <Band box={rowEdge(tryRow)} tone="row" show={during('try_col', 'end')} />
      <Band box={colEdge(tryCol)} tone="col" show={during('try_done', 'end')} />

      <SvgText x={a.x + a.width / 2} y={15} size={15} className={`${HAND} fill-muted`}>
        A
      </SvgText>
      <SvgText x={b.x + b.width / 2} y={15} size={15} className={`${HAND} fill-muted`}>
        B
      </SvgText>
      <SvgText x={p.x + p.width / 2} y={15} size={15} className={`${HAND} fill-muted`}>
        {reached('end') ? copy.right : copy.mine}
      </SvgText>

      {[a, b, p].map((box) => (
        <g key={box.x} transform={`translate(${box.x} ${TOP})`}>
          <SvgBracket width={box.width} height={box.height} />
        </g>
      ))}
      <SvgText x={b.x - OPERATOR / 2} y={TOP + a.height / 2} className="fill-muted font-matrix">
        ×
      </SvgText>
      <SvgText x={p.x - OPERATOR / 2} y={TOP + a.height / 2} className="fill-muted font-matrix">
        =
      </SvgText>

      {left.map((cells, i) =>
        cells.map((value, j) => (
          <Fade key={`a${i}:${j}`} show to={leftOpacity(i, j)} length={0.1}>
            <SvgText
              x={a.cx(j)}
              y={a.cy(i)}
              size={font}
              className="fill-ink font-matrix tabular-nums"
            >
              {rationalText(value)}
            </SvgText>
          </Fade>
        )),
      )}
      {right.map((cells, i) =>
        cells.map((value, j) => (
          <Fade key={`b${i}:${j}`} show to={rightOpacity(i, j)} length={0.1}>
            <SvgText
              x={b.cx(j)}
              y={b.cy(i)}
              size={font}
              className="fill-ink font-matrix tabular-nums"
            >
              {rationalText(value)}
            </SvgText>
          </Fade>
        )),
      )}

      {student.map((cells, i) =>
        cells.map((value, j) => {
          const isFocus = i === row && j === col;
          const isTry = i === tryRow && j === tryCol;
          return (
            <AnswerCell
              key={`p${i}:${j}`}
              x={p.cx(j)}
              y={p.cy(i)}
              mine={value}
              right={product[i][j]}
              font={font}
              marked={reached(isFocus ? 'answer' : isTry ? 'try_done' : 'end')}
              start={isFocus ? 0.42 : isTry ? 0.78 : 0.1 + 0.12 * (i + j)}
            />
          );
        }),
      )}

      <Ring cx={p.cx(col)} cy={p.cy(row)} r={cell * 0.46} show={during('caught', 'answer')} />
      <Ring cx={a.cx(col)} cy={a.cy(row)} r={cell * 0.42} show={beat === 'did'} />
      <Ring cx={b.cx(col)} cy={b.cy(row)} r={cell * 0.42} show={beat === 'did'} start={0.15} />
      <Ring
        cx={p.cx(tryCol)}
        cy={p.cy(tryRow)}
        r={cell * 0.46}
        tone="row"
        show={during('try_row', 'try_done')}
      />

      {/* ---- what they answered against what is right */}
      <Reveal show={beat === 'caught'} start={0.08}>
        <HandText x={92} y={180} size={18} className="fill-muted">
          {copy.mine}
        </HandText>
        <HandText x={92} y={245} size={68} className="fill-brand">
          {rationalText(student[row][col])}
        </HandText>
      </Reveal>
      <Reveal show={beat === 'caught'} start={0.32}>
        <path
          d="M150 248 C165 238 180 238 196 246 M186 236 L197 246 L184 254"
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-muted"
        />
        <HandText x={250} y={180} size={18} className="fill-muted">
          {copy.right}
        </HandText>
      </Reveal>
      <Reveal show={beat === 'caught'} start={0.42} pop>
        <HandText x={250} y={245} size={68} className="fill-cta">
          {rationalText(product[row][col])}
        </HandText>
      </Reveal>

      {/* ---- the one multiplication they did */}
      <Reveal show={beat === 'did'} start={0.3}>
        <HandText x={WIDTH / 2} y={235} size={46} className="fill-warn">
          {`${rationalText(left[row][col])} × ${rationalText(right[row][col])} = ${rationalText(student[row][col])}`}
        </HandText>
      </Reveal>

      {/* ---- the receipt */}
      <m.g
        initial={false}
        animate={{ y: paperIn ? 0 : HEIGHT }}
        transition={still ? { duration: 0 } : { type: 'spring', stiffness: 130, damping: 20 }}
      >
        <g className="paper">
          <path
            d={paperPath(paperHeight)}
            transform={`rotate(-0.7 ${WIDTH / 2} ${PAPER_Y + paperHeight / 2})`}
            className="fill-surface"
            style={{ filter: 'drop-shadow(0 6px 10px rgb(0 0 0 / 0.4))' }}
          />
          <HandText
            x={ITEM_X}
            y={PAPER_Y + 30}
            size={20}
            anchor="start"
            className="fill-ink font-semibold"
          >
            {clip.who}
          </HandText>
          <SvgText x={QTY_X} y={PAPER_Y + 60} size={13} className="fill-muted font-sans">
            {clip.labels.qty}
          </SvgText>
          <SvgText x={PRICE_X} y={PAPER_Y + 60} size={13} className="fill-muted font-sans">
            {clip.labels.price}
          </SvgText>
          <SvgText x={AMOUNT_X} y={PAPER_Y + 60} size={13} className="fill-muted font-sans">
            {clip.labels.result}
          </SvgText>

          {lines.map(({ item, qty, price, amount }, k) => (
            <g key={item}>
              <HandText x={ITEM_X} y={lineY(k)} size={20} anchor="start">
                {item}
              </HandText>
              <Reveal show={reached('quantities')} start={0.46 + 0.08 * k}>
                <rect
                  x={QTY_X - 17}
                  y={lineY(k) - 17}
                  width={34}
                  height={34}
                  rx={6}
                  className="fill-marker"
                />
                <HandText x={QTY_X} y={lineY(k)} size={25}>
                  {rationalText(qty)}
                </HandText>
              </Reveal>
              <Reveal show={reached('prices')} start={0.42 + 0.08 * k}>
                <SvgText x={TIMES_X} y={lineY(k)} size={17} className="fill-muted font-matrix">
                  ×
                </SvgText>
                <rect
                  x={PRICE_X - 17}
                  y={lineY(k) - 17}
                  width={34}
                  height={34}
                  rx={6}
                  className="fill-brand-soft"
                />
                <HandText x={PRICE_X} y={lineY(k)} size={25}>
                  {rationalText(price)}
                </HandText>
              </Reveal>
              <Reveal
                show={k === theirLine ? reached('only_first') : reached('all_lines')}
                start={k === theirLine ? 0.08 : 0.12}
              >
                <SvgText x={EQUALS_X} y={lineY(k)} size={17} className="fill-muted font-matrix">
                  =
                </SvgText>
                <HandText x={AMOUNT_X} y={lineY(k)} size={25} className="fill-brand">
                  {rationalText(amount)}
                </HandText>
              </Reveal>
              {k !== theirLine && (
                <Reveal show={beat === 'only_first'} start={0.42} pop>
                  <HandText x={AMOUNT_X} y={lineY(k)} size={32} className="fill-warn font-semibold">
                    ?
                  </HandText>
                </Reveal>
              )}
            </g>
          ))}

          <Reveal show={beat === 'only_first'} start={0.04}>
            <rect
              x={QTY_X - 24}
              y={lineY(theirLine) - 24}
              width={AMOUNT_X - QTY_X + 48}
              height={48}
              rx={12}
              fill="none"
              strokeWidth={2.5}
              className="stroke-warn"
            />
          </Reveal>

          <Reveal show={reached('all_lines')} start={0.36}>
            <line
              x1={ITEM_X}
              x2={PAPER_X + PAPER_WIDTH - 20}
              y1={ruleY}
              y2={ruleY}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              className="stroke-muted"
            />
            <HandText
              x={ITEM_X}
              y={totalY}
              size={22}
              anchor="start"
              className="fill-ink font-semibold"
            >
              {copy.total}
            </HandText>
          </Reveal>
          <Reveal show={reached('all_lines')} start={0.46} pop>
            <rect
              x={AMOUNT_X - 28}
              y={totalY - 21}
              width={56}
              height={42}
              rx={8}
              className="fill-marker"
            />
            <HandText x={AMOUNT_X} y={totalY} size={34} className="fill-brand font-semibold">
              {rationalText(total)}
            </HandText>
          </Reveal>
        </g>
      </m.g>

      {/* ---- numbers on their way down to the receipt, and the total on its way up */}
      {lines.map(({ item, qty, price }, k) => (
        <g key={item}>
          <Fly
            from={{ x: a.cx(k), y: a.cy(row) }}
            to={{ x: QTY_X, y: lineY(k) }}
            show={beat === 'quantities'}
            start={0.18 + 0.08 * k}
            length={0.3}
          >
            <Chip width={34} height={34} size={25} tone="fill-marker">
              {rationalText(qty)}
            </Chip>
          </Fly>
          <Fly
            from={{ x: b.cx(col), y: b.cy(k) }}
            to={{ x: PRICE_X, y: lineY(k) }}
            show={beat === 'prices'}
            start={0.1 + 0.08 * k}
            length={0.34}
          >
            <Chip width={34} height={34} size={25} tone="fill-brand-soft">
              {rationalText(price)}
            </Chip>
          </Fly>
        </g>
      ))}
      <Fly
        from={{ x: AMOUNT_X, y: totalY }}
        to={{ x: p.cx(col), y: p.cy(row) }}
        show={beat === 'answer'}
        start={0.08}
        length={0.36}
        shrinkTo={0.8}
      >
        <Chip width={56} height={42} size={34} tone="fill-marker" ink="fill-brand font-semibold">
          {rationalText(total)}
        </Chip>
      </Fly>

      {/* ---- the rule, big enough to remember */}
      <Reveal show={ruleShown} start={0.1} pop>
        <HandText x={82} y={240} size={58} className="fill-cta font-semibold">
          {copy.rowWord}
        </HandText>
      </Reveal>
      <Reveal show={ruleShown} start={0.22}>
        <HandText x={170} y={246} size={22} className="fill-muted">
          {copy.pairWith}
        </HandText>
      </Reveal>
      <Reveal show={ruleShown} start={0.3} pop>
        <HandText x={258} y={240} size={58} className="fill-brand font-semibold">
          {copy.colWord}
        </HandText>
      </Reveal>

      {/* ---- their turn */}
      <Reveal show={during('try_row', 'try_done')} start={0.04}>
        <HandText x={WIDTH / 2} y={178} size={18} className="fill-muted">
          {copy.ringed}
        </HandText>
        <HandText x={WIDTH / 2} y={228} size={32} className="fill-cta font-semibold">
          {chip(copy.rowChip, reached('try_col'), tryRow)}
        </HandText>
        <HandText x={WIDTH / 2} y={272} size={18} className="fill-muted">
          {copy.pairWith}
        </HandText>
        <HandText x={WIDTH / 2} y={316} size={32} className="fill-brand font-semibold">
          {chip(copy.colChip, reached('try_done'), tryCol)}
        </HandText>
      </Reveal>

      {beat === 'try_row' &&
        left.map((_, i) => (
          <TapArea
            key={i}
            hit={rowHit(i)}
            edge={rowEdge(i)}
            tone="row"
            label={fillTokens(copy.rowChip, { n: String(i + 1) })}
            onTap={() => tap('row', i)}
          />
        ))}
      {beat === 'try_col' &&
        right[0].map((_, j) => (
          <TapArea
            key={j}
            hit={colHit(j)}
            edge={colEdge(j)}
            tone="col"
            label={fillTokens(copy.colChip, { n: String(j + 1) })}
            onTap={() => tap('col', j)}
          />
        ))}
      {flash && (
        <m.rect
          key={flash.n}
          {...flash.box}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: still ? 0 : 0.7 }}
          rx={8}
          className="pointer-events-none fill-warn/50"
        />
      )}

      <Reveal show={worked} start={0.05}>
        <HandText x={WIDTH / 2} y={205} size={32}>
          {clip.tryTerms
            .map(({ a: x, b: y }) => `${rationalText(x)} × ${rationalText(y)}`)
            .join(' + ')}
        </HandText>
      </Reveal>
      <Reveal show={worked} start={0.22}>
        <HandText x={WIDTH / 2} y={258} size={32}>
          {`= ${clip.tryTerms.map(({ product: value }) => rationalText(value)).join(' + ')}`}
        </HandText>
      </Reveal>
      <Reveal show={worked} start={0.42} pop>
        <HandText x={WIDTH / 2} y={322} size={52} className="fill-cta font-semibold">
          {`= ${rationalText(clip.tryTotal)}`}
        </HandText>
      </Reveal>
      <Fly
        from={{ x: WIDTH / 2 + 20, y: 322 }}
        to={{ x: p.cx(tryCol), y: p.cy(tryRow) }}
        show={worked}
        start={0.62}
        length={0.2}
        shrinkTo={0.75}
      >
        <SvgText size={34} className={`${HAND} fill-cta font-semibold`}>
          {rationalText(clip.tryTotal)}
        </SvgText>
      </Fly>
    </svg>
  );
}

export function ReceiptClipPlayer({
  clip,
  doneLabel,
  onDone,
  onSkip,
}: {
  clip: ReceiptClip;
  doneLabel: string;
  onDone(): void;
  onSkip(): void;
}) {
  const [hint, setHint] = useState<{ beat: ReceiptBeat; text: string } | null>(null);
  return (
    <ClipPlayer
      title={copy.title}
      beats={RECEIPT_BEATS}
      beatMs={clip.beatMs}
      waits={WAITING_BEATS}
      aspect={WIDTH / HEIGHT}
      caption={(beat) => (hint?.beat === beat ? hint.text : clip.captions[beat])}
      stage={(beat, advance) => (
        <ReceiptStage
          clip={clip}
          beat={beat}
          onWrong={(text) => setHint({ beat, text })}
          onRight={() => {
            setHint(null);
            advance();
          }}
        />
      )}
      doneLabel={doneLabel}
      onDone={onDone}
      onSkip={onSkip}
    />
  );
}
